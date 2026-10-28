"""Gap scoring logic: demand, supply, gap, confidence."""

import logging

logger = logging.getLogger(__name__)


def compute_gap(demand: float, supply: float) -> float:
    """
    Compute the taste gap score.

    High demand + low supply = high gap (opportunity).
    demand and supply should both be in [0, 1].
    """
    return demand * (1.0 - supply)


def compute_confidence(qloo_result_count: int, venue_count: int) -> str:
    """
    Compute a confidence label based on data availability.

    Returns 'high', 'medium', or 'low'.
    """
    if qloo_result_count >= 10 and venue_count >= 0:
        return "high"
    elif qloo_result_count >= 5:
        return "medium"
    return "low"


def normalize_demand(raw_scores: list[float]) -> list[float]:
    """
    Min-max normalize demand scores across cells.

    Args:
        raw_scores: List of raw demand values (e.g., Qloo result counts
                    or aggregate relevance scores).

    Returns:
        List of normalized values in [0, 1].
    """
    if not raw_scores:
        return []

    min_val = min(raw_scores)
    max_val = max(raw_scores)

    if max_val == min_val:
        # All values are the same — return 0.5 for all
        return [0.5] * len(raw_scores)

    return [(v - min_val) / (max_val - min_val) for v in raw_scores]


def normalize_supply(venue_count: int, saturation: int) -> float:
    """
    Normalize supply based on venue count and saturation threshold.

    Args:
        venue_count: Number of existing venues of this concept type.
        saturation: Number of venues at which the area is considered saturated.

    Returns:
        Value in [0, 1].
    """
    return min(1.0, venue_count / saturation) if saturation > 0 else 0.0
