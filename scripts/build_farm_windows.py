#!/usr/bin/env python3
"""Export the hand-audited operator windows as a standalone, checkable artifact.

These windows are the second arm of the proposed E3 eligibility policy: a wallet
is a *clear* sybil if it carries three or more evidence families **or** it sits
in one of these hand-verified operator patterns.  The first arm is already in
every published analysis (`wallets[].member_families`); this file supplies the
second, and nothing else does.

It is deliberately its own artifact rather than a field on a version:

* the windows are a property of a wallet's own deposits, not of any rule set, so
  one file serves every analysis version — including a retuned one;
* adding a field to a published version would change its ``content_hash`` and
  rewrite it, which `PROVENANCE.md` forbids.

Each window ships its predicate in machine-readable form, so a reader can
re-derive the membership from the snapshot instead of trusting the list.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUDIT_HARNESS = PROJECT_ROOT / "audit" / "harness"
sys.path.insert(0, str(AUDIT_HARNESS))

import sk_v2  # noqa: E402
from sybilkit import Dataset  # noqa: E402

SNAPSHOT_PATH = PROJECT_ROOT / "data" / "curator_snapshot.json.gz"
ENRICH_PATH = PROJECT_ROOT / "audit" / "data" / "enrichment" / "full_enrich.json"
OUTPUT = PROJECT_ROOT / "data" / "audited_farm_windows.json.gz"
SCHEMA_VERSION = 1

#: One entry per window `sk_v2.build_extra` builds, restating its predicate in
#: data.  `sk_v2` stays the definition of record; a drift between the two is a
#: bug, and `verify()` below is what catches it.
PREDICATES = {
    "0.45@h3-4": {"deposits": 1, "amount_eth": "0.45", "first_hour": [3, 4]},
    "14.0@h3-15": {"deposits": 1, "amount_eth": "14.0", "first_hour": [3, 15]},
    "10.0@h5": {"deposits": 1, "amount_eth": "10.0", "first_hour": [5, 5]},
    "1.2@h1-2": {"deposits": 1, "amount_eth": "1.2", "first_hour": [1, 2]},
    "2.067": {"deposits": 1, "amount_eth": "2.067", "first_hour": [0, 66]},
    "0.45@h34-37": {"deposits": 1, "amount_eth": "0.45", "first_hour": [34, 37]},
    "ring99(any dep 90-110Ξ h16-19)": {
        "any_deposit_eth": [90, 110], "first_hour": [16, 19],
        "note": "the ≈99 ETH serial peel chain",
    },
    "ladder10.x(5-step h37-45)": {
        "deposits": 5, "min_deposit_eth": ["9.9", "10.0"], "max_deposit_eth": ["10.3", "10.4"],
    },
    "bitget-ladder(1.19-1.69 h17-31)": {
        "first_funder": "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23",
        "first_hour": [17, 31], "first_amount_eth": [1.1, 1.8],
    },
    "0.05 recyclers(3 small hubs)": {
        "first_funder_in": [
            "0x3230466e58bb1019f5695ff55248ece1e753eb79",
            "0x2fc92dde494064724fd371e55172877f86d842e9",
            "0x2e0db3f849b19b8d23993c4434ed02bf930d94f2",
        ]
    },
    "jitter1.10-1.14(h36-55)": {
        "deposits": 1, "amount_eth": [1.10, 1.14], "min_decimals": 6, "first_hour": [36, 55],
    },
    "jitter1.00-1.05(h56-64)": {
        "deposits": 1, "amount_eth": [1.00, 1.05], "min_decimals": 6, "first_hour": [56, 64],
    },
    "ladder0.05→0.45(h35-37)": {
        "deposits": 5, "amounts_eth": ["0.05", "0.15", "0.25", "0.35", "0.45"],
        "first_hour": [35, 37],
    },
    **{
        f"idxrun_{start}": {"first_index": [start, start + 99]}
        for start in (12058, 13326, 13795, 13897, 14001)
    },
}


def read_gzip_json(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_windows() -> dict[str, set[str]]:
    snapshot = read_gzip_json(SNAPSHOT_PATH)
    supplemental = json.loads(ENRICH_PATH.read_text(encoding="utf-8"))
    txs = dict(snapshot["enrichment"]["txs"])
    funding = dict(snapshot["enrichment"]["funding"])
    for key, row in supplemental["txs"].items():
        txs.setdefault(key, row)
    for key, row in supplemental["funding"].items():
        funding.setdefault(key, row)
    dataset = Dataset.from_events(
        snapshot["events"], snapshot["first_deposits"], txs=txs, funding=funding
    )
    # `hour_saved` only feeds the rescuer metric, which this export does not use.
    return sk_v2.build_extra(dataset, {"hour_saved": []})["farm_windows"]


def verify(windows: dict[str, set[str]]) -> None:
    """Every window must be named here, and no name may describe nothing."""
    missing = sorted(set(windows) - set(PREDICATES))
    if missing:
        raise SystemExit(f"sk_v2 grew windows with no published predicate: {missing}")
    stale = sorted(set(PREDICATES) - set(windows))
    if stale:
        raise SystemExit(f"predicates describe windows sk_v2 no longer builds: {stale}")
    for name, members in windows.items():
        if not members:
            raise SystemExit(f"window {name!r} is empty; a published accusation must have members")


def write(payload: dict) -> bool:
    encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    body = gzip.compress(encoded, compresslevel=9, mtime=0)
    if OUTPUT.exists() and OUTPUT.read_bytes() == body:
        return False
    OUTPUT.write_bytes(body)
    return True


def main() -> None:
    windows = build_windows()
    verify(windows)
    members = sorted(set().union(*windows.values()))
    payload = {
        "schema_version": SCHEMA_VERSION,
        # No wall-clock stamp: the content is a function of the snapshot alone,
        # so re-running must not churn the file or its digest.
        "provenance": {
            "source": "audit/harness/sk_v2.py :: build_extra()['farm_windows']",
            "snapshot_sha256": sha256(SNAPSHOT_PATH),
            "rules_sha256": sha256(AUDIT_HARNESS / "sk_v2.py"),
            "note": (
                "Hand-audited operator patterns over the frozen population. Membership is a "
                "property of a wallet's own deposits and first funder, independent of any rule "
                "set or analysis version. A window is evidence for review, not proof of "
                "common ownership."
            ),
        },
        "member_count": len(members),
        "members": members,
        "windows": [
            {
                "id": name,
                "predicate": PREDICATES[name],
                "count": len(windows[name]),
                "members": sorted(windows[name]),
            }
            for name in sorted(windows)
        ],
    }
    changed = write(payload)
    print(
        f"{'wrote' if changed else 'unchanged'} {OUTPUT} — "
        f"{len(payload['windows'])} windows, {len(members)} distinct wallets"
    )


if __name__ == "__main__":
    main()
