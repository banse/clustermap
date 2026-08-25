from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from clustermap.app import create_app
from clustermap.config import PROJECT_ROOT, Settings
from clustermap.models.repository import CuratorRepository


@pytest.fixture(scope="session")
def repository() -> CuratorRepository:
    return CuratorRepository(PROJECT_ROOT / "data" / "curator_snapshot.json.gz")


@pytest.fixture(scope="session")
def client(repository: CuratorRepository, tmp_path_factory: pytest.TempPathFactory) -> TestClient:
    settings = Settings(
        host="127.0.0.1",
        port=8766,
        snapshot_path=repository.snapshot_path,
        dashboard_dist=Path(tmp_path_factory.mktemp("missing-dashboard")),
        eth_usd=None,
    )
    return TestClient(create_app(settings=settings, repository=repository))

