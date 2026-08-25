from __future__ import annotations

from clustermap.models.repository import CuratorRepository


def test_final_contract_population_is_loaded(repository: CuratorRepository) -> None:
    overview = repository.overview()

    assert overview["provenance"]["contract"] == "0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91"
    assert overview["totals"] == {
        "population": 19_522,
        "deposits": 28_353,
        "groups": 263,
        "linked_wallets": 11_573,
        "unlinked_wallets": 7_949,
        "points": 29_675_956,
        "linked_points": 17_103_032,
        "tx_fingerprints": 12_203,
        "funding_rows": 12_498,
        "status_counts": {"clean": 7_949, "review": 0, "flagged": 11_573},
    }


def test_versions_are_immutable_and_published_remains_the_default(
    repository: CuratorRepository,
) -> None:
    versions = repository.versions()

    assert versions["published_version"] == "2026-08-22-shipped"
    assert [(row["id"], row["cluster_count"]) for row in versions["versions"]] == [
        ("2026-08-22-shipped", 263),
        ("2026-08-25-v2h", 160),
    ]
    assert all(len(row["content_hash"]) == 64 for row in versions["versions"])
    assert repository.overview()["version"]["published"] is True


def test_v2h_candidate_and_delta_reproduce_the_audit_counts(
    repository: CuratorRepository,
) -> None:
    candidate = repository.overview("2026-08-25-v2h")
    delta = repository.delta("2026-08-22-shipped", "2026-08-25-v2h")

    assert candidate["totals"]["population"] == 19_522
    assert candidate["totals"]["groups"] == 160
    assert candidate["totals"]["status_counts"] == {
        "clean": 6_782,
        "review": 324,
        "flagged": 12_416,
    }
    assert delta["released"] == 2_082
    assert delta["newly_flagged"] == 2_925
    assert sum(delta["counts"].values()) == 19_522
    assert len(delta["wallet_classes"]) == 19_522


def test_same_version_delta_is_entirely_unchanged(
    repository: CuratorRepository,
) -> None:
    delta = repository.delta("2026-08-25-v2h", "2026-08-25-v2h")

    assert delta["counts"] == {
        "improved": 0,
        "worsened": 0,
        "under_review": 0,
        "unchanged": 19_522,
    }
    assert delta["released"] == 0
    assert delta["newly_flagged"] == 0


def test_wallet_history_qualifies_cluster_ids_by_version(
    repository: CuratorRepository,
) -> None:
    address = repository.global_map("2026-08-25-v2h")["nodes"][0]["address"]
    detail = repository.wallet(address, "2026-08-25-v2h")

    assert detail is not None
    assert detail["version"] == "2026-08-25-v2h"
    assert [row["version"] for row in detail["history"]] == [
        "2026-08-22-shipped",
        "2026-08-25-v2h",
    ]
    assert all("cluster_id" in row and "status" in row for row in detail["history"])


def test_largest_group_has_typed_evidence_edges(repository: CuratorRepository) -> None:
    detail = repository.cluster(0)

    assert detail is not None
    assert detail["cluster"]["size"] == 1_104
    assert len(detail["nodes"]) == 1_104
    assert detail["edges"]
    node_ids = {node["id"] for node in detail["nodes"]}
    assert all(
        edge["source"] in node_ids and edge["target"] in node_ids
        for edge in detail["edges"]
    )
    assert any(edge["family"] == "funding" and edge["is_transfer"] for edge in detail["edges"])
    assert any(edge["family"] != "funding" and not edge["is_transfer"] for edge in detail["edges"])


def test_global_map_covers_every_wallet_with_a_sparse_evidence_tree(
    repository: CuratorRepository,
) -> None:
    global_map = repository.global_map()
    nodes = global_map["nodes"]
    edges = global_map["edges"]

    assert len(nodes) == 19_522
    assert len(edges) == 11_573 - 263
    assert sum(global_map["meta"]["risk_counts"].values()) == len(nodes)
    assert all(node["risk"] == "independent" for node in nodes if node["cluster_id"] is None)
    assert all(edge["risk"] in {"review", "elevated", "critical"} for edge in edges)
    assert global_map["meta"]["review_cluster_count"] > 0


def test_cluster_assessment_exposes_reviewable_false_positive_signals(
    repository: CuratorRepository,
) -> None:
    summaries = repository.overview()["clusters"]
    behavioural_only = next(
        summary for summary in summaries if "funding" not in summary["families"]
    )

    assert behavioural_only["review_flag"] is True
    assert behavioural_only["review_reasons"]
    assert behavioural_only["risk"] in {"review", "elevated"}


def test_original_list_filters_and_searches(repository: CuratorRepository) -> None:
    linked = repository.list_rows(link="linked", limit=1)
    unlinked = repository.list_rows(link="unlinked", limit=1)
    address = linked["rows"][0]["address"]
    searched = repository.list_rows(query=address.upper(), limit=10)

    assert linked["total"] == 11_573
    assert unlinked["total"] == 7_949
    assert [row["address"] for row in searched["rows"]] == [address]
    assert searched["rows"][0]["cluster_id"] is not None


def test_maxpane_presets_and_export(repository: CuratorRepository) -> None:
    first = repository.list_rows(preset="first1000", limit=1)
    hour = repository.list_rows(preset="hour0", limit=200)
    whales = repository.list_rows(preset="whale", limit=1_000)
    exported = repository.export_rows(preset="whale")

    assert first["total"] == 1_000
    assert 1 <= first["rows"][0]["first_index"] <= 1_000
    assert hour["total"] == 96
    assert all(row["first_hour"] == 0 for row in hour["rows"])
    assert whales["total"] == 568
    assert exported["count"] == whales["total"]
    assert exported["snapshot_block"] == 25_807_057


def test_wallet_keeps_clean_separate_from_unknown(repository: CuratorRepository) -> None:
    clean = repository.list_rows(link="unlinked", limit=1)["rows"][0]

    detail = repository.wallet(clean["address"])

    assert detail is not None
    assert detail["status"] == "unlinked"
    assert detail["cluster"] is None
    assert repository.wallet("0x0000000000000000000000000000000000000000") is None


def test_a_member_held_by_one_family_does_not_inherit_its_groups_tier(
    repository: CuratorRepository,
) -> None:
    """The audit's finding, pinned.

    A cluster's tier is computed from the cluster's evidence. Rendering it for
    every member turned wallets carried by a single rule into "critical"
    verdicts on group reasons that were false for them specifically —
    `0x3195c3f9…` sat at 0.97 confidence on a cited peel chain whose funder is
    not even in the list. Fewer than two incident families is the same
    threshold the cluster gate uses, applied per member.
    """
    detail = repository.wallet("0x3195c3f94154364e897711e501e104f40d8e23fb")
    assert detail is not None
    assert detail["cluster"]["risk"] == "critical"
    assert detail["member_families"] == ["amount"]
    assert detail["member_risk"] == "review"

    nodes = {node["address"]: node for node in repository.global_map()["nodes"]}
    node = nodes["0x3195c3f94154364e897711e501e104f40d8e23fb"]
    assert node["risk"] == "review"
    assert node["cluster_risk"] == "critical"


def test_every_wallets_own_tier_is_capped_by_its_own_evidence(
    repository: CuratorRepository,
) -> None:
    for node in repository.global_map()["nodes"]:
        if node["cluster_id"] is None:
            assert node["risk"] == "independent"
            continue
        if len(node["member_families"]) < 2:
            assert node["risk"] == "review", node["address"]
        else:
            assert node["risk"] == node["cluster_risk"], node["address"]


def test_the_export_carries_its_own_provenance_and_known_defects(
    repository: CuratorRepository,
) -> None:
    """An export gets forked and cited long after its context is gone."""
    payload = repository.export_rows(preset="first1000")
    assert payload["detector"]["name"] == "sybilkit"
    assert payload["detector"]["version"]
    assert payload["detector"]["generated_at"].endswith("Z")
    assert any("not proof of common ownership" in c for c in payload["caveats"])
    assert any("audit" in c for c in payload["caveats"])
    row = payload["rows"][0]
    assert "member_families" in row
    assert row["member_family_count"] == len(row["member_families"])
    assert row["under_review"] is (row["cluster_id"] is not None and row["member_family_count"] < 2)


def test_no_edge_is_drawn_stronger_than_the_wallets_it_joins(
    repository: CuratorRepository,
) -> None:
    """A link claims only what its endpoints support.

    A cluster's tier is a property of the group. Once a member is capped at
    "review" by its own evidence, an edge still drawn at the group's tier claims
    more about that pair than anything measured about them — and renders as a
    red line between two yellow dots.
    """
    order = ("independent", "review", "elevated", "critical")
    gm = repository.global_map()
    node_risk = {node["address"]: node["risk"] for node in gm["nodes"]}
    for edge in gm["edges"]:
        endpoints = min(
            order.index(node_risk[edge["source"]]),
            order.index(node_risk[edge["target"]]),
        )
        assert order.index(edge["risk"]) <= endpoints, edge
        assert order.index(edge["risk"]) <= order.index(edge["cluster_risk"])
