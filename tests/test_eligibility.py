from __future__ import annotations

import pytest
from sybilkit.eligibility import (
    POLICIES_BY_ID,
    AuditedWindows,
    evaluate,
    wallet_standing,
)

from clustermap.models.repository import CuratorRepository

V2 = "2026-08-25-sybilkit-0.2.0"


def _wallet(address="0xaa", status="flagged", families=(), cluster_id=0):
    return {
        "address": address,
        "status": status,
        "member_families": list(families),
        "cluster_id": cluster_id,
    }


def test_a_policy_never_excludes_a_wallet_the_analysis_did_not_flag() -> None:
    """Policies narrow what being flagged costs; they never widen the net."""
    windows = AuditedWindows(frozenset({"0xaa"}), (), {})
    for status in ("clean", "review"):
        wallet = _wallet(status=status, families=("amount", "cadence", "funding", "gas"))
        for policy in POLICIES_BY_ID.values():
            assert policy.excludes(wallet, 5, windows.members) is False


def test_each_policy_reads_its_own_evidence() -> None:
    windows = AuditedWindows(frozenset({"0xfarm"}), (), {})
    two_families = _wallet(families=("amount", "cadence"))
    three_families = _wallet(families=("amount", "cadence", "funding"))
    audited = _wallet(address="0xfarm", families=("amount", "cadence"))

    assert POLICIES_BY_ID["E0"].excludes(two_families, 1, windows.members) is True
    assert POLICIES_BY_ID["E3"].excludes(two_families, 3, windows.members) is False
    assert POLICIES_BY_ID["E3"].excludes(three_families, 1, windows.members) is True
    assert POLICIES_BY_ID["E3"].excludes(audited, 1, windows.members) is True
    assert POLICIES_BY_ID["E9"].excludes(two_families, 3, windows.members) is True
    assert POLICIES_BY_ID["E9"].excludes(two_families, 2, windows.members) is False


def test_a_missing_window_artifact_disables_only_the_policy_that_needs_it() -> None:
    clusters = [{"id": 0, "families": ["a", "b", "c"]}]
    summaries = evaluate([_wallet()], clusters, AuditedWindows.empty())
    by_id = {row["id"]: row for row in summaries}
    assert by_id["E3"]["available"] is False
    assert by_id["E0"]["available"] is True and by_id["E9"]["available"] is True
    assert wallet_standing(_wallet(), {"families": ["a"]}, AuditedWindows.empty()) == [
        {"id": "E0", "label": POLICIES_BY_ID["E0"].label, "proposal": False, "eligible": False},
        {"id": "E9", "label": POLICIES_BY_ID["E9"].label, "proposal": True, "eligible": True},
    ]


def test_missing_artifact_is_not_an_error(tmp_path) -> None:
    assert AuditedWindows.load(tmp_path / "absent.json.gz").available is False


@pytest.mark.parametrize(
    ("policy_id", "excluded", "eligible"),
    [("E0", 12_416, 7_106), ("E3", 11_747, 7_775), ("E9", 12_018, 7_504)],
)
def test_published_policy_counts_match_the_harness(
    repository: CuratorRepository, policy_id: str, excluded: int, eligible: int
) -> None:
    """Re-derived in audit/harness by p5_measure_eligibility; pinned here."""
    payload = repository.eligibility(V2)
    row = next(p for p in payload["policies"] if p["id"] == policy_id)
    assert (row["excluded"], row["eligible"]) == (excluded, eligible)
    assert payload["binding"] is None


def test_a_flagged_wallet_can_be_eligible_under_a_narrower_policy(
    repository: CuratorRepository,
) -> None:
    """The 'linked but eligible' case the whole layer exists to express."""
    payload = repository.eligibility(V2)
    e3 = next(p for p in payload["policies"] if p["id"] == "E3")
    assert e3["eligible_by_analysis_status"]["flagged"] == 669
    assert e3["eligible_by_analysis_status"]["clean"] == 6_782
    assert e3["eligible_by_analysis_status"]["review"] == 324
