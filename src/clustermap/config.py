"""Runtime configuration with safe, local defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as exc:
        raise ValueError("CLUSTERMAP_PORT must be an integer") from exc
    if not 1 <= port <= 65535:
        raise ValueError("CLUSTERMAP_PORT must be between 1 and 65535")
    return port


def _optional_price(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    try:
        price = float(value)
    except ValueError as exc:
        raise ValueError("CLUSTERMAP_ETH_USD must be numeric") from exc
    if price <= 0:
        raise ValueError("CLUSTERMAP_ETH_USD must be positive")
    return price


@dataclass(frozen=True, slots=True)
class Settings:
    host: str
    port: int
    snapshot_path: Path
    dashboard_dist: Path
    eth_usd: float | None

    @classmethod
    def from_env(cls) -> Settings:
        raw_snapshot = Path(os.environ.get("CLUSTERMAP_SNAPSHOT", "data/curator_snapshot.json.gz"))
        snapshot = raw_snapshot if raw_snapshot.is_absolute() else PROJECT_ROOT / raw_snapshot
        return cls(
            host=os.environ.get("CLUSTERMAP_HOST", "127.0.0.1"),
            port=_port(os.environ.get("CLUSTERMAP_PORT", "8766")),
            snapshot_path=snapshot,
            dashboard_dist=PROJECT_ROOT / "dashboard" / "dist",
            eth_usd=_optional_price(os.environ.get("CLUSTERMAP_ETH_USD")),
        )

