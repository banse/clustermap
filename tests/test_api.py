from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_and_overview(client: TestClient) -> None:
    health = client.get("/api/v1/health")
    overview = client.get("/api/v1/overview")

    assert health.status_code == 200
    assert health.json()["status"] == "ready"
    assert overview.status_code == 200
    assert overview.json()["totals"]["groups"] == 263


def test_cluster_and_wallet_routes(client: TestClient) -> None:
    cluster = client.get("/api/v1/clusters/0")
    address = cluster.json()["nodes"][0]["address"]
    wallet = client.get(f"/api/v1/wallets/{address}")

    assert cluster.status_code == 200
    assert wallet.status_code == 200
    assert wallet.json()["cluster"]["id"] == 0
    assert client.get("/api/v1/clusters/9999").status_code == 404


def test_global_map_route(client: TestClient) -> None:
    response = client.get("/api/v1/map/global")

    assert response.status_code == 200
    assert response.json()["meta"]["node_count"] == 19_522
    assert response.json()["meta"]["edge_count"] == 11_310


def test_address_validation_and_list_bounds(client: TestClient) -> None:
    assert client.get("/api/v1/wallets/not-an-address").status_code == 422
    assert client.get("/api/v1/list?limit=201").status_code == 422

    page = client.get("/api/v1/list?link=linked&evidence=high&limit=5")
    assert page.status_code == 200
    assert len(page.json()["rows"]) == 5
    assert all(row["evidence_band"] == "high" for row in page.json()["rows"])


def test_maxpane_preset_and_browser_export(client: TestClient) -> None:
    preset = client.get("/api/v1/list?preset=first1000&limit=10")
    exported = client.get("/api/v1/list/export?preset=hour0")

    assert preset.status_code == 200
    assert preset.json()["total"] == 1_000
    assert exported.status_code == 200
    assert exported.json()["count"] == 96
    assert exported.headers["content-disposition"] == (
        'attachment; filename="the-list-hour0.json"'
    )


def test_unbuilt_dashboard_has_direction(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"
