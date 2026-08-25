"""Export the final MaxPane Curator cache into CLUSTERMAP's compact snapshot."""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

CONTRACT = "0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91"
DEPLOYMENT_BLOCK = 25_769_870
POINTS_PER_ETH = 1_000
MIN_DEPOSIT_WEI = 50_000_000_000_000_000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache",
        type=Path,
        default=Path.home() / ".maxpane" / "curator_cache.json",
    )
    parser.add_argument(
        "--raw-list",
        type=Path,
        default=Path.home() / ".maxpane" / "curator_raw_list.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "curator_snapshot.json.gz",
    )
    return parser.parse_args()


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def export(cache_path: Path, raw_list_path: Path, output: Path) -> dict:
    cache = read_json(cache_path)
    raw_list = read_json(raw_list_path)
    cluster_slot = cache.get("last_good", {}).get("clusters", {}).get("payload", {})
    enrichment = cluster_slot.get("enrichment")
    if not isinstance(enrichment, dict):
        raise ValueError("MaxPane cache has no complete cluster enrichment slot")
    events = cache.get("events")
    first_deposits = cache.get("first_deposits")
    if not isinstance(events, list) or not isinstance(first_deposits, list):
        raise ValueError("MaxPane cache has no decoded Curator event population")
    if not isinstance(raw_list, list) or len(raw_list) != len(first_deposits):
        raise ValueError("raw list does not match the first-deposit population")

    revision_path = Path(__file__).resolve().parents[1] / "vendor" / "sybilkit" / "UPSTREAM_COMMIT"
    revision = revision_path.read_text(encoding="utf-8").strip()
    snapshot = {
        "schema_version": 1,
        "meta": {
            "chain_id": 1,
            "chain_name": "Ethereum",
            "contract": CONTRACT,
            "deployment_block": DEPLOYMENT_BLOCK,
            "snapshot_block": int(cache["last_seen_block"]),
            "maxpane_saved_at": float(cache["saved_at"]),
            "maxpane_cache_version": int(cache["version"]),
            "population_count": len(raw_list),
            "deposit_count": len(events),
            "sybilkit_version": "0.1.1",
            "sybilkit_revision": revision,
        },
        "analysis_config": {
            "points_per_eth": POINTS_PER_ETH,
            "min_deposit_wei": MIN_DEPOSIT_WEI,
        },
        "events": events,
        "first_deposits": first_deposits,
        "raw_list": raw_list,
        "enrichment": {
            "txs": enrichment.get("txs", {}),
            "funding": enrichment.get("funding", {}),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    output.write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
    return snapshot["meta"]


def main() -> None:
    args = parse_args()
    meta = export(args.cache, args.raw_list, args.output)
    print(
        f"wrote {args.output} — {meta['population_count']} wallets, "
        f"{meta['deposit_count']} deposits, block {meta['snapshot_block']}"
    )


if __name__ == "__main__":
    main()

