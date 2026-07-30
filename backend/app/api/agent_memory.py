from __future__ import annotations

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..schemas import (
    AccountRead,
    PersonalizationBaselineRead,
    PreferenceCorrection,
    PreferenceCreate,
    PreferenceDetailRead,
    PreferenceMutationResult,
    PreferenceRead,
    PreferenceRestoreRequest,
    PreferenceSource,
    PreferenceUserCreate,
    ProposalCreate,
    ProposalDecisionCreate,
    ProposalDecisionRequest,
    ProposalDetailRead,
    ProposalDraftCreate,
    ProposalOutcomeCreate,
    ProposalOutcomeConsentUpdate,
    ProposalOutcomeFeedback,
    ProposalOutcomeRead,
    ProposalRead,
    ProposalStatus,
)
from ..services import (
    PreferenceNotFound,
    PersonalizationBaselineService,
    PreferenceService,
    PreferenceVersionConflict,
    ProposalExpired,
    ProposalLedgerService,
    ProposalNotFound,
    ProposalOutcomeConsentVersionConflict,
    ProposalOutcomeNotFound,
    ProposalVersionConflict,
)
from .dependencies import get_connection, get_current_user


router = APIRouter(tags=["agent-memory"])


@router.post(
    "/preferences",
    response_model=PreferenceRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_preference(
    request: PreferenceUserCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> PreferenceRead:
    try:
        return PreferenceService(connection, user.id).create(
            PreferenceCreate(
                source="user_stated",
                preference_key=request.preference_key,
                value=request.value,
                scope_type=request.scope_type,
                scope_ref_id=request.scope_ref_id,
                provenance={"source": "account"},
            )
        )
    except sqlite3.IntegrityError as exc:
        raise _conflict(
            "preference_conflict",
            "The preference scope or identity is not available for this account",
        ) from exc


@router.get("/preferences", response_model=list[PreferenceRead])
async def list_preferences(
    source: PreferenceSource | None = None,
    include_deleted: bool = False,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[PreferenceRead]:
    return PreferenceService(connection, user.id).list(
        source=source,
        include_deleted=include_deleted,
    )


@router.get("/preferences/{preference_id}", response_model=PreferenceDetailRead)
async def get_preference(
    preference_id: int,
    include_deleted: bool = False,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> PreferenceDetailRead:
    try:
        return PreferenceService(connection, user.id).detail(
            preference_id,
            include_deleted=include_deleted,
        )
    except PreferenceNotFound as exc:
        raise _preference_not_found(preference_id) from exc


@router.patch(
    "/preferences/{preference_id}",
    response_model=PreferenceMutationResult,
)
async def correct_preference(
    preference_id: int,
    request: PreferenceCorrection,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> PreferenceMutationResult:
    service = PreferenceService(connection, user.id)
    try:
        current = service.get(preference_id)
        corrected = service.replace(
            preference_id,
            PreferenceCreate(
                source="user_stated",
                preference_key=current.preference_key,
                value=request.value,
                scope_type=current.scope_type,
                scope_ref_id=current.scope_ref_id,
                provenance={
                    "corrected_from": current.source,
                    "previous_version": current.version,
                },
            ),
            expected_version=request.expected_version,
            reason=request.reason,
        )
        revision = service.detail(preference_id).revisions[-1]
        return PreferenceMutationResult(
            preference=corrected,
            revision_id=revision.id,
        )
    except PreferenceNotFound as exc:
        raise _preference_not_found(preference_id) from exc
    except PreferenceVersionConflict as exc:
        raise _preference_version_conflict(exc) from exc
    except sqlite3.IntegrityError as exc:
        raise _conflict(
            "preference_conflict",
            "The preference correction could not be persisted",
        ) from exc


@router.delete(
    "/preferences/{preference_id}",
    response_model=PreferenceMutationResult,
)
async def delete_preference(
    preference_id: int,
    expected_version: Annotated[int, Query(ge=1)],
    reason: Annotated[str, Query(max_length=1000)] = "",
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> PreferenceMutationResult:
    service = PreferenceService(connection, user.id)
    try:
        deleted = service.delete(
            preference_id,
            expected_version=expected_version,
            reason=reason,
        )
        revision = service.detail(
            preference_id,
            include_deleted=True,
        ).revisions[-1]
        return PreferenceMutationResult(
            preference=deleted,
            revision_id=revision.id,
        )
    except PreferenceNotFound as exc:
        raise _preference_not_found(preference_id) from exc
    except PreferenceVersionConflict as exc:
        raise _preference_version_conflict(exc) from exc


@router.post(
    "/preferences/{preference_id}/restore",
    response_model=PreferenceMutationResult,
)
async def restore_preference(
    preference_id: int,
    request: PreferenceRestoreRequest,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> PreferenceMutationResult:
    service = PreferenceService(connection, user.id)
    try:
        restored = service.restore(
            preference_id,
            expected_version=request.expected_version,
            reason=request.reason,
        )
        revision = service.detail(preference_id).revisions[-1]
        return PreferenceMutationResult(
            preference=restored,
            revision_id=revision.id,
        )
    except PreferenceNotFound as exc:
        raise _preference_not_found(preference_id) from exc
    except PreferenceVersionConflict as exc:
        raise _preference_version_conflict(exc) from exc


@router.post(
    "/proposals",
    response_model=ProposalRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_proposal(
    request: ProposalDraftCreate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalRead:
    return ProposalLedgerService(connection, user.id).create(
        ProposalCreate(source="deterministic", **request.model_dump())
    )


@router.get("/proposals", response_model=list[ProposalRead])
async def list_proposals(
    proposal_status: ProposalStatus | None = Query(default=None, alias="status"),
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> list[ProposalRead]:
    return ProposalLedgerService(connection, user.id).list(status=proposal_status)


@router.get("/proposals/{proposal_id}", response_model=ProposalDetailRead)
async def get_proposal(
    proposal_id: int,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalDetailRead:
    try:
        return ProposalLedgerService(connection, user.id).detail(proposal_id)
    except ProposalNotFound as exc:
        raise _proposal_not_found(proposal_id) from exc


@router.post(
    "/proposals/{proposal_id}/decisions",
    response_model=ProposalDetailRead,
)
async def decide_proposal(
    proposal_id: int,
    request: ProposalDecisionRequest,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalDetailRead:
    service = ProposalLedgerService(connection, user.id)
    try:
        service.decide(
            proposal_id,
            ProposalDecisionCreate.model_validate(
                request.model_dump(exclude={"expected_version"})
            ),
            expected_version=request.expected_version,
        )
        return service.detail(proposal_id)
    except ProposalNotFound as exc:
        raise _proposal_not_found(proposal_id) from exc
    except ProposalExpired as exc:
        raise _conflict(
            "proposal_expired",
            "This proposal expired before the decision was recorded",
        ) from exc
    except ProposalVersionConflict as exc:
        raise _conflict(
            "version_conflict",
            "The proposal changed after it was loaded",
            current=exc.current.model_dump(mode="json"),
        ) from exc


@router.post(
    "/proposals/{proposal_id}/outcomes",
    response_model=ProposalOutcomeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_proposal_outcome(
    proposal_id: int,
    request: ProposalOutcomeFeedback,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalOutcomeRead:
    try:
        return ProposalLedgerService(connection, user.id).add_outcome(
            ProposalOutcomeCreate(
                proposal_id=proposal_id,
                **request.model_dump(),
            )
        )
    except ProposalNotFound as exc:
        raise _proposal_not_found(proposal_id) from exc


@router.patch(
    "/proposals/{proposal_id}/outcomes/{outcome_id}/consent",
    response_model=ProposalOutcomeRead,
)
async def update_proposal_outcome_consent(
    proposal_id: int,
    outcome_id: int,
    request: ProposalOutcomeConsentUpdate,
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> ProposalOutcomeRead:
    try:
        return ProposalLedgerService(
            connection, user.id
        ).update_outcome_consent(
            proposal_id,
            outcome_id,
            expected_version=request.expected_version,
            personalization_consent=request.personalization_consent,
        )
    except ProposalNotFound as exc:
        raise _proposal_not_found(proposal_id) from exc
    except ProposalOutcomeNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "proposal_outcome_not_found",
                "message": f"Outcome {outcome_id} was not found",
            },
        ) from exc
    except ProposalOutcomeConsentVersionConflict as exc:
        raise _conflict(
            "version_conflict",
            "The outcome consent changed after it was loaded",
            current=exc.current.model_dump(mode="json"),
        ) from exc


@router.get(
    "/personalization/baseline",
    response_model=PersonalizationBaselineRead,
)
async def get_personalization_baseline(
    user: AccountRead = Depends(get_current_user),
    connection: sqlite3.Connection = Depends(get_connection),
) -> PersonalizationBaselineRead:
    return PersonalizationBaselineService(connection, user.id).read()


def _preference_not_found(preference_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "preference_not_found",
            "message": f"Preference {preference_id} was not found",
        },
    )


def _proposal_not_found(proposal_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "proposal_not_found",
            "message": f"Proposal {proposal_id} was not found",
        },
    )


def _preference_version_conflict(error: PreferenceVersionConflict) -> HTTPException:
    return _conflict(
        "version_conflict",
        "The preference changed after it was loaded",
        current=error.current.model_dump(mode="json"),
    )


def _conflict(
    code: str,
    message: str,
    *,
    current: object | None = None,
) -> HTTPException:
    detail: dict[str, object] = {"code": code, "message": message}
    if current is not None:
        detail["current"] = current
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail,
    )
