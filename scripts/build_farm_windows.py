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
from sybilkit.farm_windows import (  # noqa: E402
    PREDICATES,
    members,
    require_non_empty,
    verify,
)

SNAPSHOT_PATH = PROJECT_ROOT / "data" / "curator_snapshot.json.gz"
ENRICH_PATH = PROJECT_ROOT / "audit" / "data" / "enrichment" / "full_enrich.json"
OUTPUT = PROJECT_ROOT / "data" / "audited_farm_windows.json.gz"
SCHEMA_VERSION = 1

def read_gzip_json(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_windows():
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
    windows = {
        name: frozenset(group)
        for name, group in sk_v2.build_extra(dataset, {"hour_saved": []})["farm_windows"].items()
    }
    # Every published predicate must re-derive its own membership, or the export
    # is documentation rather than a check. The first copy of this table got the
    # ring wrong and nothing noticed.
    verify(windows, dataset)
    require_non_empty(windows)
    return windows


def write(payload: dict) -> bool:
    encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    body = gzip.compress(encoded, compresslevel=9, mtime=0)
    if OUTPUT.exists() and OUTPUT.read_bytes() == body:
        return False
    OUTPUT.write_bytes(body)
    return True


def main() -> None:
    windows = build_windows()
    distinct = sorted(members(windows))
    payload = {
        "schema_version": SCHEMA_VERSION,
        # No wall-clock stamp: the content is a function of the snapshot alone,
        # so re-running must not churn the file or its digest.
        "provenance": {
            "source": (
                "audit/harness/sk_v2.py :: build_extra()['farm_windows'], "
                "verified against sybilkit.farm_windows.PREDICATES"
            ),
            "snapshot_sha256": sha256(SNAPSHOT_PATH),
            "rules_sha256": sha256(AUDIT_HARNESS / "sk_v2.py"),
            "note": (
                "Hand-audited operator patterns over the frozen population. Membership is a "
                "property of a wallet's own deposits and first funder, independent of any rule "
                "set or analysis version. A window is evidence for review, not proof of "
                "common ownership."
            ),
        },
        "member_count": len(distinct),
        "members": distinct,
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
        f"{len(payload['windows'])} windows, {len(distinct)} distinct wallets"
    )


if __name__ == "__main__":
    main()
