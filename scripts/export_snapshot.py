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
    parser.add_argument(
        "--ens-only",
        action="store_true",
        help="refresh only forward-verified ENS names in the existing snapshot",
    )
    return parser.parse_args()


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_gzip_json(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def write_snapshot(path: Path, snapshot: dict) -> bool:
    """Write the snapshot, and report whether that changed the file.

    The gzip stream is deterministic (fixed level, `mtime=0`), so an identical
    snapshot re-encodes to identical bytes. Skipping that write keeps a refresh
    that observed nothing new from churning a file this project pins by tag and
    hashes in `data/list_quality_stats.json.gz`.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload = gzip.compress(encoded, compresslevel=9, mtime=0)
    if path.exists() and path.read_bytes() == payload:
        return False
    path.write_bytes(payload)
    return True


def _normalise_address(value: object) -> str | None:
    if not isinstance(value, str) or len(value) != 42 or not value.startswith("0x"):
        return None
    try:
        int(value[2:], 16)
    except ValueError:
        return None
    return value.lower()


def merge_verified_ens(snapshot: dict, cache: dict) -> dict:
    """Attach MaxPane's reverse-and-forward-verified ENS names to every list row."""
    raw_list = snapshot.get("raw_list")
    if not isinstance(raw_list, list):
        raise ValueError("snapshot has no raw list")

    rows_by_address: dict[str, dict] = {}
    for row in raw_list:
        if not isinstance(row, dict):
            raise ValueError("snapshot raw list contains a malformed row")
        address = _normalise_address(row.get("address"))
        if address is None or address in rows_by_address:
            raise ValueError("snapshot raw list contains an invalid or duplicate address")
        rows_by_address[address] = row

    ens = cache.get("ens")
    names_blob = ens.get("names") if isinstance(ens, dict) else None
    misses_blob = ens.get("misses") if isinstance(ens, dict) else None
    if not isinstance(names_blob, dict) or not isinstance(misses_blob, dict):
        raise ValueError("MaxPane cache has no complete verified ENS store")

    names: dict[str, str] = {}
    checked_at: dict[str, float] = {}
    for raw_address, entry in names_blob.items():
        address = _normalise_address(raw_address)
        if (
            address is None
            or not isinstance(entry, (list, tuple))
            or len(entry) != 2
            or not isinstance(entry[0], str)
            or not entry[0].strip()
        ):
            raise ValueError("MaxPane cache contains a malformed ENS name")
        try:
            stamp = float(entry[1])
        except (TypeError, ValueError) as exc:
            raise ValueError("MaxPane cache contains a malformed ENS timestamp") from exc
        names[address] = entry[0].strip()
        checked_at[address] = stamp

    for raw_address, raw_stamp in misses_blob.items():
        address = _normalise_address(raw_address)
        if address is None:
            raise ValueError("MaxPane cache contains a malformed ENS miss address")
        try:
            stamp = float(raw_stamp)
        except (TypeError, ValueError) as exc:
            raise ValueError("MaxPane cache contains a malformed ENS miss timestamp") from exc
        checked_at[address] = max(checked_at.get(address, stamp), stamp)

    population = set(rows_by_address)
    missing_checks = population - checked_at.keys()
    if missing_checks:
        raise ValueError(
            f"MaxPane ENS lookup is incomplete for {len(missing_checks)} snapshot wallets"
        )

    verified = {address: name for address, name in names.items() if address in population}
    merged_rows = []
    for row in raw_list:
        merged = dict(row)
        merged["name"] = verified.get(row["address"].lower())
        merged_rows.append(merged)

    stamps = [checked_at[address] for address in population]
    result = dict(snapshot)
    result["raw_list"] = merged_rows
    # The ENS block is rebuilt, never accumulated: a stale key from an earlier
    # refresh would outlive the observation it described.  Every value below is
    # a function of the population and the cache's ENS store alone, so a refresh
    # that sees the same names writes the same bytes.
    meta = {k: v for k, v in (result.get("meta") or {}).items() if not k.startswith("ens_")}
    meta.update(
        {
            "ens_names_count": len(verified),
            # The window every wallet in the population was checked inside —
            # names and misses alike.  `from` is the guarantee; a single `last
            # checked` stamp would be the newest lookup, not the oldest.
            "ens_checked_from": min(stamps),
            "ens_checked_to": max(stamps),
            "ens_source": "maxpane_forward_verified_reverse_ens_cache",
        }
    )
    result["meta"] = meta
    return result


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
    snapshot = merge_verified_ens(snapshot, cache)
    changed = write_snapshot(output, snapshot)
    return snapshot["meta"], changed


def refresh_ens(cache_path: Path, snapshot_path: Path) -> tuple[dict, bool]:
    cache = read_json(cache_path)
    snapshot = merge_verified_ens(read_gzip_json(snapshot_path), cache)
    changed = write_snapshot(snapshot_path, snapshot)
    return snapshot["meta"], changed


def main() -> None:
    args = parse_args()
    meta, changed = (
        refresh_ens(args.cache, args.output)
        if args.ens_only
        else export(args.cache, args.raw_list, args.output)
    )
    print(
        f"{'wrote' if changed else 'unchanged'} {args.output} — "
        f"{meta['population_count']} wallets, {meta['deposit_count']} deposits, "
        f"{meta['ens_names_count']} ENS names, block {meta['snapshot_block']}"
    )


if __name__ == "__main__":
    main()
