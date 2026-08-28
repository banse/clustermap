from __future__ import annotations

from fastapi.testclient import TestClient

RAW_VERSION = "2026-08-22-whitelistcurator-raw"


def test_health_and_overview(client: TestClient) -> None:
    health = client.get("/api/v1/health")
    overview = client.get("/api/v1/overview")

    assert health.status_code == 200
    assert health.json()["status"] == "ready"
    assert health.json()["quality_stats"] == "loaded"
    assert overview.status_code == 200
    assert overview.json()["totals"]["groups"] == 160


def test_stats_route_is_version_pinned_and_reports_measured_quality(
    client: TestClient,
) -> None:
    published = client.get("/api/v1/stats")
    superseded = client.get("/api/v1/stats?version=2026-08-22-shipped")

    assert published.status_code == 200
    payload = published.json()
    assert payload["version"]["id"] == "2026-08-25-sybilkit-0.2.0"
    assert payload["outcome"]["raw_wallets"] == 19_522
    assert payload["outcome"]["retained_wallets"] == 7_106
    assert payload["nft"]["observed_block"] == 25_853_521
    assert payload["nft"]["raw_unique_holders"] == 38
    assert payload["nft"]["retained_unique_holders"] == 38
    assert payload["ladder"]["pattern_wallets"] == 564
    assert payload["ladder"]["status_counts"] == {
        "clean": 304,
        "review": 116,
        "flagged": 144,
    }
    assert payload["ladder"]["counterfactual"]["no_longer_flagged"] == 37
    assert payload["maturity"]["raw"]["median_prior_transactions"] == 0
    assert payload["maturity"]["retained"]["median_prior_transactions"] == 47

    assert superseded.status_code == 200
    assert superseded.json()["ladder"]["counterfactual"] is None
    assert client.get("/api/v1/stats?version=nope").status_code == 404


def test_cluster_and_wallet_routes(client: TestClient) -> None:
    cluster = client.get("/api/v1/clusters/0")
    address = cluster.json()["nodes"][0]["address"]
    wallet = client.get(f"/api/v1/wallets/{address}")

    assert cluster.status_code == 200
    assert wallet.status_code == 200
    assert wallet.json()["cluster"]["id"] == 0
    assert wallet.json()["original_population"] == 19_522
    assert "retained_rank" in wallet.json()
    assert wallet.json()["retained_population"] == 7_106
    assert all("retained_rank" in row for row in wallet.json()["history"])
    assert client.get("/api/v1/clusters/9999").status_code == 404


def test_global_map_route(client: TestClient) -> None:
    response = client.get("/api/v1/map/global")

    assert response.status_code == 200
    assert response.json()["meta"]["node_count"] == 19_522
    assert response.json()["meta"]["edge_count"] == 12_580


def test_address_validation_and_list_bounds(client: TestClient) -> None:
    assert client.get("/api/v1/wallets/not-an-address").status_code == 422
    assert client.get("/api/v1/list?limit=201").status_code == 422
    assert client.get("/api/v1/list?sort=unknown").status_code == 422
    assert client.get("/api/v1/list?direction=sideways").status_code == 422

    page = client.get("/api/v1/list?link=linked&evidence=high&limit=5")
    assert page.status_code == 200
    assert len(page.json()["rows"]) == 5
    assert all(row["evidence_band"] == "high" for row in page.json()["rows"])
    assert all("retained_rank" in row for row in page.json()["rows"])
    assert all("clean_rank" in row for row in page.json()["rows"])
    assert [row["filter_rank"] for row in page.json()["rows"]] == list(range(1, 6))
    assert all("deposit_total_eth" in row for row in page.json()["rows"])
    assert all("last_hour" in row for row in page.json()["rows"])

    retained = client.get("/api/v1/list?link=retained&limit=200")
    assert retained.status_code == 200
    assert retained.json()["total"] == 7_106
    assert {row["status"] for row in retained.json()["rows"]} == {"clean", "review"}

    sorted_page = client.get(
        "/api/v1/list?link=retained&sort=points&direction=asc&limit=5"
    )
    assert sorted_page.status_code == 200
    sorted_rows = sorted_page.json()["rows"]
    assert [row["points"] for row in sorted_rows] == sorted(
        row["points"] for row in sorted_rows
    )
    assert [row["filter_rank"] for row in sorted_rows] != list(range(1, 6))


def test_maxpane_preset_and_browser_export(client: TestClient) -> None:
    preset = client.get(
        f"/api/v1/list?version={RAW_VERSION}&preset=first1000&limit=10"
    )
    exported = client.get(
        "/api/v1/list/export?preset=hour0&sort=points&direction=desc"
    )
    ens = client.get("/api/v1/list?preset=ens&limit=20")

    assert preset.status_code == 200
    assert preset.json()["total"] == 1_000
    assert exported.status_code == 200
    assert exported.json()["count"] == 87
    assert ens.status_code == 200
    assert ens.json()["total"] == 8
    assert all(row["name"] for row in ens.json()["rows"])
    assert client.get("/api/v1/list?preset=first1000").status_code == 422
    assert exported.json()["filters"]["sort"] == "points"
    assert exported.json()["filters"]["direction"] == "desc"
    assert [row["points"] for row in exported.json()["rows"]] == sorted(
        (row["points"] for row in exported.json()["rows"]),
        reverse=True,
    )
    assert exported.headers["content-disposition"] == (
        'attachment; filename="the-list-2026-08-25-sybilkit-0.2.0-hour0.json"'
    )


def test_analysis_versions_and_directional_delta(client: TestClient) -> None:
    versions = client.get("/api/v1/versions")
    raw = client.get(f"/api/v1/versions/{RAW_VERSION}")
    published = client.get("/api/v1/versions/2026-08-25-sybilkit-0.2.0")
    superseded = client.get("/api/v1/versions/2026-08-22-shipped")
    delta = client.get(
        "/api/v1/delta?base=2026-08-22-shipped&head=2026-08-25-sybilkit-0.2.0"
    )

    assert versions.status_code == 200
    assert versions.json()["published_version"] == "2026-08-25-sybilkit-0.2.0"
    assert [version["cluster_count"] for version in versions.json()["versions"]] == [
        0,
        263,
        160,
    ]
    assert raw.status_code == 200
    assert raw.json()["list_scope"] == "raw"
    assert raw.json()["status_counts"] == {
        "clean": 19_522,
        "flagged": 0,
        "review": 0,
    }
    assert published.status_code == 200
    assert published.json()["published"] is True
    assert superseded.status_code == 200
    assert superseded.json()["published"] is False
    assert delta.status_code == 200
    assert sum(delta.json()["counts"].values()) == 19_522
    assert delta.json()["released"] == 2_082
    assert delta.json()["newly_flagged"] == 2_925


def test_version_is_pinned_across_data_routes(client: TestClient) -> None:
    version = "2026-08-25-sybilkit-0.2.0"
    overview = client.get(f"/api/v1/overview?version={version}")
    global_map = client.get(f"/api/v1/map/global?version={version}")
    cluster = client.get(f"/api/v1/clusters/0?version={version}")
    wallet = client.get(
        f"/api/v1/wallets/{global_map.json()['nodes'][0]['address']}?version={version}"
    )
    page = client.get(f"/api/v1/list?version={version}&limit=1")

    assert overview.json()["version"]["id"] == version
    assert overview.json()["totals"]["groups"] == 160
    assert global_map.json()["version"] == version
    assert cluster.json()["version"] == version
    assert wallet.json()["version"] == version
    assert len(wallet.json()["history"]) == 3
    assert page.json()["version"] == version
    assert page.json()["rows"][0]["version"] == version
    assert client.get("/api/v1/overview?version=does-not-exist").status_code == 404


def test_delta_self_comparison_and_wallet_filter(client: TestClient) -> None:
    version = "2026-08-22-shipped"
    same = client.get(f"/api/v1/delta?base={version}&head={version}")
    released = client.get(
        "/api/v1/delta/wallets?base=2026-08-22-shipped"
        "&head=2026-08-25-sybilkit-0.2.0&class=improved&limit=5"
    )

    assert same.json()["counts"] == {
        "improved": 0,
        "worsened": 0,
        "under_review": 0,
        "unchanged": 19_522,
    }
    assert released.status_code == 200
    assert released.json()["total"] == 1_900
    assert all(row["class"] == "improved" for row in released.json()["rows"])


def test_changelog_filters_chain_generated_and_authored_entries(client: TestClient) -> None:
    all_entries = client.get("/api/v1/changelog")
    analysis = client.get("/api/v1/changelog?kind=analysis")
    dated = client.get("/api/v1/changelog?from=2026-08-25&to=2026-08-25")

    assert all_entries.status_code == 200
    assert any(entry["id"].startswith("chain-hour-") for entry in all_entries.json()["entries"])
    assert {entry["kind"] for entry in analysis.json()["entries"]} == {"analysis"}
    assert {entry["id"] for entry in dated.json()["entries"]} >= {
        "publication-presentation-correction",
        "analysis-sybilkit-0-2-0",
    }


def test_unbuilt_dashboard_has_direction(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_review_route_is_version_pinned(client: TestClient) -> None:
    published = client.get("/api/v1/review")
    superseded = client.get("/api/v1/review?version=2026-08-22-shipped")

    assert published.status_code == 200
    assert published.json()["totals"]["review_wallets"] == 324
    assert published.json()["groups"][0]["review_count"] == 88
    assert superseded.status_code == 200
    assert superseded.json()["totals"]["review_wallets"] == 0
    assert client.get("/api/v1/review?version=nope").status_code == 404
