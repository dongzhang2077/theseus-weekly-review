from __future__ import annotations

from backend.app.db.repositories import UserRepository
from backend.app.schemas import (
    LocalUserCreate,
    ProposalCreate,
    ProposalOutcomeCreate,
)
from backend.app.services import (
    PersonalizationEvaluationService,
    ProposalLedgerService,
)
from scripts.evaluate_personalization_baseline import build_snapshot


def test_evaluation_snapshot_excludes_unconsented_and_unrated_outcomes(
    connection,
) -> None:
    owner = UserRepository(connection).create(
        LocalUserCreate(display_name="Evaluation owner")
    )
    _add_rated_outcomes(connection, owner.id, [4] * 5, consent=True)
    _add_rated_outcomes(connection, owner.id, [5], consent=False)
    _add_outcome(
        connection,
        owner.id,
        usefulness=None,
        consent=True,
        title="Private unrated feedback",
    )

    other = UserRepository(connection).create(
        LocalUserCreate(display_name="Other evaluation owner")
    )
    _add_rated_outcomes(connection, other.id, [5] * 30, consent=True)

    snapshot = PersonalizationEvaluationService(
        connection,
        owner.id,
    ).read()

    assert snapshot.status == "insufficient_data"
    assert snapshot.eligible_outcome_count == 5
    assert snapshot.consented_unrated_outcome_count == 1
    assert snapshot.remaining_eligible_outcomes == 25
    assert snapshot.training_outcome_count == 0
    assert snapshot.holdout_outcome_count == 0
    assert snapshot.usefulness_baseline is None
    assert snapshot.ranking_evaluation_supported is False
    assert snapshot.blockers == (
        "insufficient_consented_rated_outcomes",
        "candidate_set_exposure_not_recorded",
    )
    assert snapshot.excluded_text_fields == (
        "proposal_title",
        "outcome_note",
    )


def test_evaluation_snapshot_uses_chronological_holdout_and_type_mean(
    connection,
) -> None:
    owner = UserRepository(connection).create(
        LocalUserCreate(display_name="Ready evaluation owner")
    )
    _add_rated_outcomes(connection, owner.id, [4] * 20, consent=True)
    _add_rated_outcomes(connection, owner.id, [5] * 9, consent=True)
    _add_outcome(
        connection,
        owner.id,
        usefulness=3,
        consent=True,
        title="Sanitized reflection proposal",
        proposal_type="reflection",
    )

    snapshot = PersonalizationEvaluationService(
        connection,
        owner.id,
    ).read()

    assert snapshot.status == "baseline_ready"
    assert snapshot.eligible_outcome_count == 30
    assert snapshot.remaining_eligible_outcomes == 0
    assert snapshot.training_outcome_count == 20
    assert snapshot.holdout_outcome_count == 10
    assert snapshot.candidate_method_evaluated is False
    assert snapshot.ranking_evaluation_supported is False
    assert snapshot.blockers == ("candidate_set_exposure_not_recorded",)
    assert snapshot.usefulness_baseline is not None
    assert snapshot.usefulness_baseline.method == (
        "proposal_type_mean_with_global_fallback"
    )
    assert snapshot.usefulness_baseline.global_training_mean == 4.0
    assert snapshot.usefulness_baseline.mean_absolute_error == 1.0
    assert snapshot.usefulness_baseline.type_specific_prediction_count == 9
    assert snapshot.usefulness_baseline.global_fallback_prediction_count == 1


def test_read_only_cli_snapshot_contains_no_proposal_text(database) -> None:
    with database.session() as connection:
        owner = UserRepository(connection).create(
            LocalUserCreate(display_name="CLI evaluation owner")
        )
        _add_outcome(
            connection,
            owner.id,
            usefulness=4,
            consent=True,
            title="Do not export this proposal title",
            note="Do not export this private note",
        )

    snapshot = build_snapshot(database.path, owner.id)
    serialized = str(snapshot)

    assert snapshot["status"] == "insufficient_data"
    assert snapshot["eligible_outcome_count"] == 1
    assert "Do not export this proposal title" not in serialized
    assert "Do not export this private note" not in serialized


def _add_rated_outcomes(
    connection,
    user_id: int,
    ratings: list[int],
    *,
    consent: bool,
) -> None:
    for index, rating in enumerate(ratings):
        _add_outcome(
            connection,
            user_id,
            usefulness=rating,
            consent=consent,
            title=f"Sanitized proposal {index}",
        )


def _add_outcome(
    connection,
    user_id: int,
    *,
    usefulness: int | None,
    consent: bool,
    title: str,
    note: str = "",
    proposal_type: str = "weekly_plan_adjustment",
) -> None:
    service = ProposalLedgerService(connection, user_id)
    proposal = service.create(
        ProposalCreate(
            proposal_type=proposal_type,
            title=title,
            before={},
            after={},
        )
    )
    service.add_outcome(
        ProposalOutcomeCreate(
            proposal_id=proposal.id,
            result="completed",
            usefulness=usefulness,
            note=note,
            personalization_consent=consent,
        )
    )
