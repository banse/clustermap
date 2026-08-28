#!/usr/bin/env python3
"""Build immutable, version-aware quality statistics for THE LIST."""

from __future__ import annotations

import gzip
import hashlib
import json
import statistics
import sys
from collections import Counter, defaultdict
from dataclasses import replace
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUDIT_HARNESS = PROJECT_ROOT / "audit" / "harness"
sys.path.insert(0, str(AUDIT_HARNESS))

import sk_v2  # noqa: E402
from sybilkit import Dataset  # noqa: E402
from sybilkit.signals import first_rows  # noqa: E402

from clustermap.models.analysis import run_analysis  # noqa: E402

SNAPSHOT_PATH = PROJECT_ROOT / "data" / "curator_snapshot.json.gz"
VERSIONS_PATH = PROJECT_ROOT / "data" / "analysis_versions.json.gz"
NFT_PATH = PROJECT_ROOT / "data" / "nft_holder_snapshot.json.gz"
OUTPUT = PROJECT_ROOT / "data" / "list_quality_stats.json.gz"
V2_ID = "2026-08-25-sybilkit-0.2.0"
V2_RULE = "v2h (v2g + aged-weak periphery)"
NONCE_BUCKETS = ("0", "1-4", "5-19", "20-99", "100+")


def read_gzip_json(path: Path) -> dict:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def write_gzip_json(path: Path, payload: dict) -> None:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as handle:
            handle.write(encoded)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def nonce_bucket(value: int) -> str:
    if value == 0:
        return "0"
    if value < 5:
        return "1-4"
    if value < 20:
        return "5-19"
    if value < 100:
        return "20-99"
    return "100+"


def maturity(addresses: set[str], nonces: dict[str, int]) -> dict:
    values = [nonces[address] for address in addresses if address in nonces]
    buckets = Counter(nonce_bucket(value) for value in values)
    zero = buckets["0"]
    median = statistics.median(values)
    return {
        "wallets": len(addresses),
        "covered_wallets": len(values),
        "median_prior_transactions": int(median) if float(median).is_integer() else median,
        "nonce_zero_wallets": zero,
        "nonce_zero_share": zero / len(values) if values else 0.0,
        "buckets": {bucket: buckets[bucket] for bucket in NONCE_BUCKETS},
    }


def exact_natural_ladders(dataset, min_deposit_wei: int) -> dict[str, tuple[int, ...]]:
    by_wallet: dict[str, list] = defaultdict(list)
    for deposit in dataset.deposits:
        by_wallet[deposit.contributor].append(deposit)
    step = 10**17
    ladders = {}
    for address, rows in by_wallet.items():
        ordered = sorted(rows, key=lambda row: (row.block_number, row.log_index))
        amounts = tuple(row.amount_wei for row in ordered)
        expected = tuple(min_deposit_wei + index * step for index in range(len(amounts)))
        if len(amounts) >= 3 and amounts == expected:
            ladders[address] = amounts
    return ladders


def counterfactual_without_natural_ladder(dataset, config, infra: frozenset[str]) -> dict:
    rules = replace(sk_v2.VARIANTS[V2_RULE], infra_extra=infra)
    original = sk_v2.tier_a_edges
    removed_reasons = Counter()

    def without_natural_ladder(ds, cfg, selected_rules):
        edges, firsts, counts = original(ds, cfg, selected_rules)
        kept = []
        for edge in edges:
            reason = edge.reason.human_string
            if reason.startswith("identical ") and "-step ladder 0.05→" in reason:
                removed_reasons[reason] += 1
                continue
            kept.append(edge)
        return kept, firsts, counts

    sk_v2.tier_a_edges = without_natural_ladder
    try:
        clusters, _, _, _ = sk_v2.run(dataset, config, rules)
    finally:
        sk_v2.tier_a_edges = original
    flagged = {member for cluster in clusters for member in cluster["core"]}
    review = {member for cluster in clusters for member in cluster["periphery"]} - flagged
    return {
        "flagged": flagged,
        "review": review,
        "removed_edges": sum(removed_reasons.values()),
        "removed_reason_count": len(removed_reasons),
    }


def control_row(
    control_id: str,
    label: str,
    meaning: str,
    population: set[str],
    retained: set[str],
) -> dict:
    present = population & retained
    return {
        "id": control_id,
        "label": label,
        "meaning": meaning,
        "raw_wallets": len(population),
        "retained_wallets": len(present),
        "removed_wallets": len(population - retained),
        "retention_rate": len(present) / len(population) if population else 0.0,
    }


def nft_stats(nft: dict, retained: set[str]) -> dict:
    raw_unique = set()
    retained_unique = set()
    collections = []
    for collection in nft["collections"]:
        holders = set(collection["holders_in_population"])
        kept = holders & retained
        raw_unique.update(holders)
        retained_unique.update(kept)
        collections.append(
            {
                "id": collection["id"],
                "name": collection["name"],
                "contract": collection["contract"],
                "explorer_url": collection["explorer_url"],
                "raw_holders": len(holders),
                "retained_holders": len(kept),
                "removed_holders": len(holders - retained),
                "retention_rate": len(kept) / len(holders) if holders else None,
            }
        )
    return {
        "benchmark": nft["benchmark"],
        "method": nft["method"],
        "observed_block": nft["observed_block"],
        "observed_at": nft["observed_at"],
        "raw_unique_holders": len(raw_unique),
        "retained_unique_holders": len(retained_unique),
        "removed_unique_holders": len(raw_unique - retained),
        "retention_rate": len(retained_unique) / len(raw_unique) if raw_unique else 0.0,
        "collections": collections,
    }


def main() -> None:
    snapshot = read_gzip_json(SNAPSHOT_PATH)
    version_artifact = read_gzip_json(VERSIONS_PATH)
    nft = read_gzip_json(NFT_PATH)
    supplemental = json.loads(
        (PROJECT_ROOT / "audit" / "data" / "enrichment" / "full_enrich.json").read_text()
    )
    txs = dict(snapshot["enrichment"]["txs"])
    funding = dict(snapshot["enrichment"]["funding"])
    for tx_hash, row in supplemental["txs"].items():
        txs.setdefault(tx_hash, row)
    for address, row in supplemental["funding"].items():
        funding.setdefault(address, row)
    dataset = Dataset.from_events(
        snapshot["events"],
        snapshot["first_deposits"],
        txs=txs,
        funding=funding,
    )
    _, config, _ = run_analysis(snapshot)
    rows_by_address = {row["address"].lower(): row for row in snapshot["raw_list"]}
    population = set(rows_by_address)
    points = {address: int(row["points"]) for address, row in rows_by_address.items()}
    nonces = {}
    for address, deposit in first_rows(dataset).items():
        tx = dataset.txs.get(deposit.tx_hash)
        if tx is not None and tx.nonce is not None:
            nonces[address] = tx.nonce
    if set(nonces) != population:
        raise ValueError("entry nonce coverage is not complete")

    ladders = exact_natural_ladders(dataset, config.protocol_min_amount_wei)
    ens = set(json.loads((PROJECT_ROOT / "audit" / "data" / "ens_names.json").read_text()))
    idmd = set(json.loads((PROJECT_ROOT / "audit" / "data" / "idmd_holders.json").read_text()))
    verified = set(
        json.loads((PROJECT_ROOT / "audit" / "data" / "controls_verified.json").read_text())
    )
    controls = {
        "ens": ens & population,
        "idmd": idmd & population,
        "verified": verified & population,
    }

    infra = frozenset(
        address.lower()
        for address in json.loads((PROJECT_ROOT / "audit" / "data" / "infra_all.json").read_text())
    )
    ablation = counterfactual_without_natural_ladder(dataset, config, infra)

    version_rows = {}
    for version in version_artifact["versions"]:
        version_id = version["metadata"]["id"]
        states = {row["address"]: row["status"] for row in version["wallets"]}
        flagged = {address for address, status in states.items() if status == "flagged"}
        retained = population - flagged
        status_counts = Counter(states.values())
        ladder_status = Counter(states[address] for address in ladders)
        counterfactual = None
        if version_id == V2_ID:
            next_status = {
                address: (
                    "flagged"
                    if address in ablation["flagged"]
                    else "review"
                    if address in ablation["review"]
                    else "clean"
                )
                for address in population
            }
            transitions = Counter(
                f"{states[address]}→{next_status[address]}" for address in population
            )
            no_longer_flagged = flagged - ablation["flagged"]
            counterfactual = {
                "rule_set": V2_RULE,
                "ignored_evidence": "Exact natural ladder amount edges beginning 0.05 ETH",
                "removed_edges": ablation["removed_edges"],
                "removed_reason_count": ablation["removed_reason_count"],
                "flagged_wallets": len(ablation["flagged"]),
                "review_wallets": len(ablation["review"]),
                "retained_wallets": len(population - ablation["flagged"]),
                "no_longer_flagged": len(no_longer_flagged),
                "pattern_wallets_no_longer_flagged": len(no_longer_flagged & set(ladders)),
                "newly_flagged": len(ablation["flagged"] - flagged),
                "transitions": dict(sorted(transitions.items())),
            }

        raw_points = sum(points.values())
        retained_points = sum(points[address] for address in retained)
        version_rows[version_id] = {
            "outcome": {
                "raw_wallets": len(population),
                "retained_wallets": len(retained),
                "removed_wallets": len(flagged),
                "retention_rate": len(retained) / len(population),
                "raw_points": raw_points,
                "retained_points": retained_points,
                "retained_points_share": retained_points / raw_points,
                "status_counts": {
                    "clean": status_counts["clean"],
                    "review": status_counts["review"],
                    "flagged": status_counts["flagged"],
                },
            },
            "nft": nft_stats(nft, retained),
            "ladder": {
                "definition": (
                    "At least three deposits whose complete ordered sequence is exactly "
                    "0.05 ETH plus 0.10 ETH per step."
                ),
                "pattern_wallets": len(ladders),
                "retained_wallets": sum(states[address] != "flagged" for address in ladders),
                "status_counts": {
                    "clean": ladder_status["clean"],
                    "review": ladder_status["review"],
                    "flagged": ladder_status["flagged"],
                },
                "lengths": dict(
                    sorted(Counter(len(values) for values in ladders.values()).items())
                ),
                "counterfactual": counterfactual,
            },
            "maturity": {
                "metric": "Transaction nonce on the wallet's first deposit",
                "interpretation": (
                    "Nonce is the number of prior outgoing transactions. It is a maturity proxy, "
                    "not a calendar age or proof of a person."
                ),
                "coverage": len(nonces) / len(population),
                "raw": maturity(population, nonces),
                "retained": maturity(retained, nonces),
            },
            "controls": [
                control_row(
                    "ens",
                    "ENS-named wallets",
                    "A public-name signal; useful as a collateral check, not identity proof.",
                    controls["ens"],
                    retained,
                ),
                control_row(
                    "idmd",
                    "IDMD holders",
                    "A pre-existing identity-NFT holder control used by the independent audit.",
                    controls["idmd"],
                    retained,
                ),
                control_row(
                    "verified",
                    "Verified controls",
                    "Wallets independently checked as false-positive controls in the audit.",
                    controls["verified"],
                    retained,
                ),
            ],
        }

    payload = {
        "schema_version": 1,
        "generated_at": nft["observed_at"],
        "snapshot_block": snapshot["meta"]["snapshot_block"],
        "population": len(population),
        "definitions": {
            "raw": "Every wallet in the frozen CuratorWhitelist snapshot.",
            "retained": (
                "Wallets not in the flagged tier: clean plus under-review wallets "
                "remain in the list."
            ),
        },
        "provenance": {
            "snapshot_sha256": sha256(SNAPSHOT_PATH),
            "versions_sha256": sha256(VERSIONS_PATH),
            "nft_snapshot_sha256": sha256(NFT_PATH),
            "nft_observed_block": nft["observed_block"],
            "nft_observed_at": nft["observed_at"],
            "nonce_coverage": len(nonces) / len(population),
            "counterfactual_rule_set": V2_RULE,
        },
        "disclaimer": (
            "These are population-level quality signals. NFT ownership, ENS names, nonce, and "
            "pattern retention do not prove that a wallet belongs to one unique person."
        ),
        "versions": version_rows,
    }
    write_gzip_json(OUTPUT, payload)
    print(f"wrote {OUTPUT}")
    for version_id, row in version_rows.items():
        outcome = row["outcome"]
        print(
            f"{version_id}: {outcome['retained_wallets']:,}/{outcome['raw_wallets']:,} retained; "
            f"median nonce {row['maturity']['raw']['median_prior_transactions']}→"
            f"{row['maturity']['retained']['median_prior_transactions']}"
        )


if __name__ == "__main__":
    main()
