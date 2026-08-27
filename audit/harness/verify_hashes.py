#!/usr/bin/env python3
"""Verify the published cluster-membership and flagged-set digests.

The point of these two digests is that reproduction covers **which wallet sits in
which group**, not merely that the totals agree.  A totals match is satisfied by
any run that happens to count the same; a membership match is not.

They were published before the recipe that produces them was committed, which
made them an assertion rather than a check.  This script is that recipe:

    membership = sha256(json.dumps(sorted(sorted(members) for each group)))[:32]
    flagged    = sha256(json.dumps(sorted(flagged addresses)))[:32]

`json.dumps` defaults are load-bearing (", " and ": " separators); a compact
`separators=(",", ":")` dump is a different string and therefore a different
digest.  Sorting happens at both levels so the answer cannot depend on dict or
set iteration order — the same hazard that once made `null_model.py` return a
different number for identical seeds.

Usage
-----
    python3 verify_hashes.py                # check the published artifact
    python3 verify_hashes.py --from-rules   # re-run the detector, then check

Exit status is 0 only if every digest matches.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

VERSION_ID = "2026-08-25-sybilkit-0.2.0"
EXPECTED_MEMBERSHIP = "bd986908e33bf6c1c4cda481dae0009f"
EXPECTED_FLAGGED = "71e561a2d104bea9f0e36e742ec54ddc"
EXPECTED_CLUSTERS = 160
EXPECTED_FLAGGED_COUNT = 12_416


def digest(value: object) -> str:
    """sha256 over the canonical JSON rendering, truncated to 32 hex chars."""
    return hashlib.sha256(json.dumps(value).encode()).hexdigest()[:32]


def membership_digest(groups: list[list[str]]) -> str:
    return digest(sorted(sorted(group) for group in groups))


def flagged_digest(addresses: set[str]) -> str:
    return digest(sorted(addresses))


def from_artifact() -> tuple[list[list[str]], set[str]]:
    """Groups and flagged set as the site actually publishes them."""
    path = os.path.join(REPO, "data", "analysis_versions.json.gz")
    if not os.path.exists(path):
        sys.exit(f"missing {path}; run `make versions` first")
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        payload = json.load(handle)
    try:
        version = next(
            v for v in payload["versions"] if v["metadata"]["id"] == VERSION_ID
        )
    except StopIteration:
        sys.exit(f"artifact carries no version {VERSION_ID}")
    by_cluster: dict[int, list[str]] = {}
    flagged: set[str] = set()
    for wallet in version["wallets"]:
        if wallet["status"] != "flagged":
            continue
        flagged.add(wallet["address"])
        by_cluster.setdefault(wallet["cluster_id"], []).append(wallet["address"])
    return list(by_cluster.values()), flagged


def from_rules() -> tuple[list[list[str]], set[str]]:
    """Groups and flagged set recomputed by running the detector itself."""
    from dataclasses import replace

    sys.path.insert(0, os.path.join(REPO, "vendor", "sybilkit", "src"))
    sys.path.insert(0, os.path.join(REPO, "src"))
    sys.path.insert(0, HERE)

    import sk_v2
    from sybilkit import Dataset

    from clustermap.models.analysis import run_analysis

    with gzip.open(
        os.path.join(REPO, "data", "curator_snapshot.json.gz"), "rt", encoding="utf-8"
    ) as handle:
        snapshot = json.load(handle)
    with open(
        os.path.join(REPO, "audit", "data", "enrichment", "full_enrich.json"),
        encoding="utf-8",
    ) as handle:
        supplemental = json.load(handle)

    txs = dict(snapshot["enrichment"]["txs"])
    funding = dict(snapshot["enrichment"]["funding"])
    for key, row in supplemental["txs"].items():
        txs.setdefault(key, row)
    for key, row in supplemental["funding"].items():
        funding.setdefault(key, row)

    dataset = Dataset.from_events(
        snapshot["events"], snapshot["first_deposits"], txs=txs, funding=funding
    )
    _, config, _ = run_analysis(snapshot)
    with open(
        os.path.join(REPO, "audit", "data", "infra_all.json"), encoding="utf-8"
    ) as handle:
        infra = frozenset(address.lower() for address in json.load(handle))

    rules = replace(
        sk_v2.VARIANTS["v2h (v2g + aged-weak periphery)"], infra_extra=infra
    )
    clusters, _edges, _firsts, _counts = sk_v2.run(dataset, config, rules)
    groups = [sorted(cluster["core"]) for cluster in clusters if cluster["core"]]
    return groups, {member for cluster in clusters for member in cluster["core"]}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--from-rules",
        action="store_true",
        help="re-run the detector instead of reading the published artifact",
    )
    args = parser.parse_args(argv)

    source = "detector re-run" if args.from_rules else "published artifact"
    groups, flagged = from_rules() if args.from_rules else from_artifact()

    checks = [
        ("groups", len(groups), EXPECTED_CLUSTERS),
        ("flagged wallets", len(flagged), EXPECTED_FLAGGED_COUNT),
        ("cluster membership", membership_digest(groups), EXPECTED_MEMBERSHIP),
        ("flagged set", flagged_digest(flagged), EXPECTED_FLAGGED),
    ]

    print(f"source: {source}\n")
    ok = True
    for label, got, want in checks:
        good = got == want
        ok &= good
        print(f"  {label:<20s} {str(got):<34s} {'OK' if good else f'MISMATCH (want {want})'}")

    print()
    print("VERIFIED" if ok else "FAILED — this is not the published analysis")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
