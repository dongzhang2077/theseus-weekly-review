from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from math import ceil
import sqlite3
from typing import Any, Literal

from ..db.repositories import ProposalRepository


MINIMUM_ELIGIBLE_OUTCOMES = 30
MINIMUM_HOLDOUT_OUTCOMES = 10
MINIMUM_TYPE_TRAINING_OUTCOMES = 3
PROTOCOL_VERSION = "v1"
BASELINE_METHOD = "proposal_type_mean_with_global_fallback"
RANKING_BLOCKER = "candidate_set_exposure_not_recorded"


@dataclass(frozen=True)
class UsefulnessBaselineMetrics:
    method: str
    mean_absolute_error: float
    global_training_mean: float
    type_specific_prediction_count: int
    global_fallback_prediction_count: int


@dataclass(frozen=True)
class PersonalizationEvaluationSnapshot:
    protocol_version: str
    status: Literal["insufficient_data", "baseline_ready"]
    eligible_outcome_count: int
    consented_unrated_outcome_count: int
    minimum_eligible_outcomes: int
    remaining_eligible_outcomes: int
    training_outcome_count: int
    holdout_outcome_count: int
    usefulness_baseline: UsefulnessBaselineMetrics | None
    candidate_method_evaluated: Literal[False]
    ranking_evaluation_supported: Literal[False]
    ranking_blocker: str
    excluded_text_fields: tuple[str, ...]
    blockers: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class PersonalizationEvaluationService:
    """Build an aggregate-only, read-only usefulness baseline snapshot."""

    def __init__(self, connection: sqlite3.Connection, user_id: int) -> None:
        self.repository = ProposalRepository(connection, user_id)

    def read(self) -> PersonalizationEvaluationSnapshot:
        observations = self.repository.list_personalization_outcomes()
        eligible = [
            observation
            for observation in observations
            if observation.usefulness is not None
        ]
        unrated_count = len(observations) - len(eligible)
        remaining = max(MINIMUM_ELIGIBLE_OUTCOMES - len(eligible), 0)
        blockers = [RANKING_BLOCKER]

        if remaining:
            blockers.insert(0, "insufficient_consented_rated_outcomes")
            return PersonalizationEvaluationSnapshot(
                protocol_version=PROTOCOL_VERSION,
                status="insufficient_data",
                eligible_outcome_count=len(eligible),
                consented_unrated_outcome_count=unrated_count,
                minimum_eligible_outcomes=MINIMUM_ELIGIBLE_OUTCOMES,
                remaining_eligible_outcomes=remaining,
                training_outcome_count=0,
                holdout_outcome_count=0,
                usefulness_baseline=None,
                candidate_method_evaluated=False,
                ranking_evaluation_supported=False,
                ranking_blocker=RANKING_BLOCKER,
                excluded_text_fields=("proposal_title", "outcome_note"),
                blockers=tuple(blockers),
            )

        holdout_count = max(
            MINIMUM_HOLDOUT_OUTCOMES,
            ceil(len(eligible) * 0.2),
        )
        training = eligible[:-holdout_count]
        holdout = eligible[-holdout_count:]
        global_mean = sum(
            observation.usefulness or 0 for observation in training
        ) / len(training)
        ratings_by_type: dict[str, list[int]] = defaultdict(list)
        for observation in training:
            if observation.usefulness is not None:
                ratings_by_type[observation.proposal_type].append(
                    observation.usefulness
                )

        absolute_errors: list[float] = []
        type_specific_count = 0
        for observation in holdout:
            type_ratings = ratings_by_type[observation.proposal_type]
            if len(type_ratings) >= MINIMUM_TYPE_TRAINING_OUTCOMES:
                prediction = sum(type_ratings) / len(type_ratings)
                type_specific_count += 1
            else:
                prediction = global_mean
            absolute_errors.append(
                abs(prediction - (observation.usefulness or 0))
            )

        metrics = UsefulnessBaselineMetrics(
            method=BASELINE_METHOD,
            mean_absolute_error=round(
                sum(absolute_errors) / len(absolute_errors),
                3,
            ),
            global_training_mean=round(global_mean, 3),
            type_specific_prediction_count=type_specific_count,
            global_fallback_prediction_count=(
                len(holdout) - type_specific_count
            ),
        )
        return PersonalizationEvaluationSnapshot(
            protocol_version=PROTOCOL_VERSION,
            status="baseline_ready",
            eligible_outcome_count=len(eligible),
            consented_unrated_outcome_count=unrated_count,
            minimum_eligible_outcomes=MINIMUM_ELIGIBLE_OUTCOMES,
            remaining_eligible_outcomes=0,
            training_outcome_count=len(training),
            holdout_outcome_count=len(holdout),
            usefulness_baseline=metrics,
            candidate_method_evaluated=False,
            ranking_evaluation_supported=False,
            ranking_blocker=RANKING_BLOCKER,
            excluded_text_fields=("proposal_title", "outcome_note"),
            blockers=(RANKING_BLOCKER,),
        )
