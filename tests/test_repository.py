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
    }


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
