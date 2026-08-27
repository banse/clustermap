from __future__ import annotations

from clustermap.models.repository import CuratorRepository


def test_final_contract_population_is_loaded(repository: CuratorRepository) -> None:
    overview = repository.overview()

    assert overview["provenance"]["contract"] == "0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91"
    assert overview["totals"] == {
        "population": 19_522,
        "deposits": 28_353,
        "groups": 160,
        "linked_wallets": 12_740,
        "unlinked_wallets": 6_782,
        "points": 29_675_956,
        "linked_points": 23_010_337,
        "tx_fingerprints": 28_353,
        "funding_rows": 19_522,
        "status_counts": {"clean": 6_782, "review": 324, "flagged": 12_416},
    }


def test_review_tier_is_grouped_and_ranked_by_share_not_count(
    repository: CuratorRepository,
) -> None:
    """The ordering is the finding, not a presentation choice.

    A group that is 73% review rests on thin evidence throughout; a group that is
    0.1% review has a solid core and one member at its edge. Ranking by review
    *count* would put the second kind first, because large groups have more of
    everything — so the page would lead with its least interesting rows.
    """
    payload = repository.review()

    assert payload["totals"]["review_wallets"] == 324
    assert payload["totals"]["groups_with_review"] == 26
    assert payload["totals"]["groups_total"] == 160

    shares = [group["review_share"] for group in payload["groups"]]
    assert shares == sorted(shares, reverse=True)

    # every wallet listed is actually in the review tier, and its group agrees
    listed = sum(len(group["wallets"]) for group in payload["groups"])
    assert listed == payload["totals"]["review_wallets"]
    for group in payload["groups"]:
        assert group["review_count"] == len(group["wallets"])
        assert 0 < group["review_share"] <= 1
        assert group["review_count"] <= group["size"]

    leader = payload["groups"][0]
    assert (leader["id"], leader["review_count"], leader["size"]) == (27, 88, 120)


def test_a_version_without_a_review_tier_says_so_rather_than_looking_empty(
    repository: CuratorRepository,
) -> None:
    """SybilKit 0.1.1 has no review tier: everything it flags, it removes.

    Zero groups here is a real answer about that analysis, so it has to be
    distinguishable from a version whose groups simply failed to load.
    """
    payload = repository.review("2026-08-22-shipped")

    assert payload["totals"]["review_wallets"] == 0
    assert payload["totals"]["groups_with_review"] == 0
    assert payload["totals"]["groups_total"] == 263
    assert payload["groups"] == []


def test_each_version_reports_the_enrichment_it_ran_on(
    repository: CuratorRepository,
) -> None:
    """The two analyses did not share an input.

    Shipped saw the snapshot's partial sweep; v2h the complete one. Reporting the
    snapshot's counts for both would understate the published analysis.
    """
    published = repository.overview()["totals"]
    superseded = repository.overview("2026-08-22-shipped")["totals"]

    assert (published["tx_fingerprints"], published["funding_rows"]) == (28_353, 19_522)
    assert (superseded["tx_fingerprints"], superseded["funding_rows"]) == (12_203, 12_498)


def test_publishing_0_2_0_moved_the_pointer_and_rewrote_no_version(
    repository: CuratorRepository,
) -> None:
    """Correct by adding a version and moving the pointer, never by rewriting one.

    SybilKit 0.2.0 became the published analysis on 2026-08-27. That is a change of which
    version the site asserts — it must not change what any earlier version said,
    so both content hashes are pinned by value. `content_hash` covers
    {wallets, clusters, global_edges} only, which is why re-labelling v0.1.0 as
    superseded leaves its hash untouched.
    """
    versions = repository.versions()
    by_id = {row["id"]: row for row in versions["versions"]}

    assert versions["published_version"] == "2026-08-25-sybilkit-0.2.0"
    assert [(row["id"], row["cluster_count"]) for row in versions["versions"]] == [
        ("2026-08-22-shipped", 263),
        ("2026-08-25-sybilkit-0.2.0", 160),
    ]
    assert by_id["2026-08-22-shipped"]["content_hash"] == (
        "9c5a1ef4882e84328bfc13da235b4d7d08f7c9fa3eebd4cf8eaab92ecc4ac616"
    )
    assert by_id["2026-08-25-sybilkit-0.2.0"]["content_hash"] == (
        "486c7787fded341765b11c178916b237b46dc7c09e486931758c179af3bf2f9f"
    )
    assert by_id["2026-08-22-shipped"]["stage"] == "superseded"
    assert by_id["2026-08-25-sybilkit-0.2.0"]["stage"] == "published"
    assert repository.overview()["version"]["id"] == "2026-08-25-sybilkit-0.2.0"
    assert repository.overview()["version"]["published"] is True


def test_sybilkit_0_2_0_and_delta_reproduce_the_audit_counts(
    repository: CuratorRepository,
) -> None:
    candidate = repository.overview("2026-08-25-sybilkit-0.2.0")
    delta = repository.delta("2026-08-22-shipped", "2026-08-25-sybilkit-0.2.0")

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
    delta = repository.delta("2026-08-25-sybilkit-0.2.0", "2026-08-25-sybilkit-0.2.0")

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
    address = repository.global_map("2026-08-25-sybilkit-0.2.0")["nodes"][0]["address"]
    detail = repository.wallet(address, "2026-08-25-sybilkit-0.2.0")

    assert detail is not None
    assert detail["version"] == "2026-08-25-sybilkit-0.2.0"
    assert [row["version"] for row in detail["history"]] == [
        "2026-08-22-shipped",
        "2026-08-25-sybilkit-0.2.0",
    ]
    assert all("cluster_id" in row and "status" in row for row in detail["history"])


def test_largest_group_has_typed_evidence_edges(repository: CuratorRepository) -> None:
    detail = repository.cluster(0)

    assert detail is not None
    assert detail["cluster"]["size"] == 997
    assert len(detail["nodes"]) == 997
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
    assert len(edges) == 12_740 - 160
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

    assert linked["total"] == 12_740
    assert unlinked["total"] == 6_782
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
    shipped = "2026-08-22-shipped"
    detail = repository.wallet("0x3195c3f94154364e897711e501e104f40d8e23fb", shipped)
    assert detail is not None
    assert detail["cluster"]["risk"] == "critical"
    assert detail["member_families"] == ["amount"]
    assert detail["member_risk"] == "review"

    nodes = {node["address"]: node for node in repository.global_map(shipped)["nodes"]}
    node = nodes["0x3195c3f94154364e897711e501e104f40d8e23fb"]
    assert node["risk"] == "review"
    assert node["cluster_risk"] == "critical"


def test_every_wallets_own_tier_is_capped_by_its_own_evidence(
    repository: CuratorRepository,
) -> None:
    for version_id in ("2026-08-22-shipped", "2026-08-25-sybilkit-0.2.0"):
        for node in repository.global_map(version_id)["nodes"]:
            if node["cluster_id"] is None:
                assert node["risk"] == "independent"
                continue
            # v2h's periphery is shown, never removed, whatever its family count.
            if node["status"] == "review" or len(node["member_families"]) < 2:
                assert node["risk"] == "review", node["address"]
            else:
                assert node["risk"] == node["cluster_risk"], node["address"]


def test_the_export_carries_its_own_provenance_and_known_defects(
    repository: CuratorRepository,
) -> None:
    """An export gets forked and cited long after its context is gone."""
    payload = repository.export_rows(preset="first1000")
    assert payload["detector"]["name"] == "sybilkit"
    assert payload["detector"]["version"] == "0.2.0"
    assert payload["detector"]["rule_set"] == "v2h (v2g + aged-weak periphery)"
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
