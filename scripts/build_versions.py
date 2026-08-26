#!/usr/bin/env python3
"""Build deterministic, immutable analysis-version artifacts offline."""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from collections import Counter
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUDIT_HARNESS = PROJECT_ROOT / "audit" / "harness"
#: The exact detector that produced these versions. "0.1.1" alone is ambiguous —
#: it spans commits with and without the library's own documented limitations and
#: its coverage/fold invariant tests, so a version that records only the version
#: string cannot be attributed to a specific detector.
DETECTOR_COMMIT = (PROJECT_ROOT / "vendor" / "sybilkit" / "UPSTREAM_COMMIT").read_text().strip()
#: The v2 rules are not sybilkit's — they are the audit harness. Pin them by
#: content rather than by commit: a reader holding the file can verify the hash
#: without a git checkout, which is the point of publishing the harness at all.
RULES_SHA256 = hashlib.sha256((AUDIT_HARNESS / "sk_v2.py").read_bytes()).hexdigest()
sys.path.insert(0, str(AUDIT_HARNESS))

import sk_v2  # noqa: E402
from sybilkit import Dataset  # noqa: E402
from sybilkit.cluster import FRESHNESS_FLOOR  # noqa: E402
from sybilkit.curve import curve_points  # noqa: E402

from clustermap.models.analysis import project_evidence_edges, run_analysis  # noqa: E402
from clustermap.models.domain import evidence_band  # noqa: E402
from clustermap.models.versions import (  # noqa: E402
    assess_cluster,
    canonical_hash,
    weakest_risk,
)

OUTPUT = PROJECT_ROOT / "data" / "analysis_versions.json.gz"
V1_ID = "2026-08-22-shipped"
V2_ID = "2026-08-25-v2h"
V2_RULE = "v2h (v2g + aged-weak periphery)"
GENERATED_AT = "2026-08-25T00:00:00Z"


def read_snapshot() -> dict:
    with gzip.open(PROJECT_ROOT / "data" / "curator_snapshot.json.gz", "rt") as handle:
        return json.load(handle)


def as_utc(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=UTC).isoformat().replace("+00:00", "Z")


def edge_dict(edge) -> dict:
    if hasattr(edge, "source"):
        source, target = sorted((edge.source.lower(), edge.target.lower()))
        reason = edge.reason
        strength = edge.strength
        family = edge.family
        is_transfer = edge.is_transfer
    else:
        source, target = sorted((edge.a.lower(), edge.b.lower()))
        reason = edge.reason.human_string
        strength = edge.strength
        family = edge.family
        is_transfer = edge.family == "funding"
    return {
        "source": source,
        "target": target,
        "family": family,
        "strength": strength,
        "reason": reason,
        "is_transfer": is_transfer,
    }


def strongest_edges(edges) -> list[dict]:
    strongest: dict[tuple[str, str, str], dict] = {}
    for raw in edges:
        edge = edge_dict(raw)
        key = (edge["source"], edge["target"], edge["family"])
        current = strongest.get(key)
        if current is None or edge["strength"] > current["strength"]:
            strongest[key] = edge
    return sorted(
        strongest.values(),
        key=lambda edge: (edge["family"], edge["source"], edge["target"]),
    )


def spanning_edges(members: list[str], edges: list[dict], node_risk: dict[str, str]) -> list[dict]:
    parent = {member: member for member in members}

    def root(address: str) -> str:
        while parent[address] != address:
            parent[address] = parent[parent[address]]
            address = parent[address]
        return address

    selected = []
    candidates = sorted(
        edges,
        key=lambda edge: (
            edge["is_transfer"],
            edge["strength"],
            edge["family"],
            edge["source"],
            edge["target"],
        ),
        reverse=True,
    )
    for edge in candidates:
        source_root = root(edge["source"])
        target_root = root(edge["target"])
        if source_root == target_root:
            continue
        parent[source_root] = target_root
        cluster_risk = edge["cluster_risk"]
        selected.append(
            {
                "source": edge["source"],
                "target": edge["target"],
                "family": edge["family"],
                "strength": edge["strength"],
                "risk": weakest_risk(
                    cluster_risk,
                    node_risk[edge["source"]],
                    node_risk[edge["target"]],
                ),
                "cluster_risk": cluster_risk,
            }
        )
        if len(selected) == len(members) - 1:
            break
    if len(selected) != len(members) - 1:
        raise ValueError("version evidence graph is disconnected")
    return selected


def confidence_for(edges: list[dict], members: list[str], dataset, firsts) -> tuple[float, list]:
    best = {}
    for edge in edges:
        current = best.get(edge["family"])
        if current is None or edge["strength"] > current["strength"]:
            best[edge["family"]] = edge
    complement = 1.0
    for edge in best.values():
        complement *= 1.0 - edge["strength"]
    confidence = 1.0 - complement
    nonces = []
    for member in members:
        first = firsts.get(member)
        tx = dataset.txs.get(first.tx_hash) if first is not None else None
        if tx is not None and tx.nonce is not None:
            nonces.append(tx.nonce)
    if nonces:
        fresh_fraction = sum(1 for nonce in nonces if nonce == 0) / len(nonces)
        confidence *= FRESHNESS_FLOOR + (1.0 - FRESHNESS_FLOOR) * fresh_fraction
    reasons = [
        {
            "family": edge["family"],
            "text": edge["reason"],
            "strength": edge["strength"],
        }
        for edge in sorted(best.values(), key=lambda edge: (-edge["strength"], edge["family"]))
    ]
    return min(1.0, max(0.0, confidence)), reasons


def final_points(dataset, points_per_eth: int) -> tuple[dict[str, int], int]:
    weights = {}
    for deposit in sorted(dataset.deposits, key=lambda row: (row.block_number, row.log_index)):
        weights[deposit.contributor] = deposit.new_weight_wei
    points = {
        address: curve_points(weight, points_per_eth) for address, weight in weights.items()
    }
    return points, sum(points.values())


def cluster_record(
    *,
    cluster_id: int,
    members: list[str],
    edges: list[dict],
    confidence: float,
    reasons: list[dict],
    points: int,
    total_points: int,
    span_blocks: int | None,
) -> dict:
    families = {reason["family"] for reason in reasons}
    risk, review_reasons = assess_cluster(confidence, families, len(members))
    normalized_edges = [{**edge, "cluster_risk": risk} for edge in edges]
    return {
        "id": cluster_id,
        "size": len(members),
        "confidence": confidence,
        "band": evidence_band(families),
        "points": points,
        "points_share": points / total_points if total_points else 0.0,
        "span_blocks": span_blocks,
        "families": sorted(families),
        "reasons": reasons,
        "edge_count": len(normalized_edges),
        "risk": risk,
        "review_flag": bool(review_reasons),
        "review_reasons": review_reasons,
        "members": members,
        "edges": normalized_edges,
    }


def finish_version(
    *,
    metadata: dict,
    rows: list[dict],
    clusters: list[dict],
    status_by_address: dict[str, str],
    display_risk_by_address: dict[str, str],
    cluster_risk_by_address: dict[str, str],
    member_families: dict[str, set[str]],
) -> dict:
    cluster_by_member = {
        member: cluster["id"] for cluster in clusters for member in cluster["members"]
    }
    wallets = [
        {
            "address": row["address"].lower(),
            "status": status_by_address[row["address"].lower()],
            "cluster_id": cluster_by_member.get(row["address"].lower()),
            "member_families": sorted(member_families.get(row["address"].lower(), set())),
            "risk": display_risk_by_address[row["address"].lower()],
            "cluster_risk": cluster_risk_by_address[row["address"].lower()],
        }
        for row in rows
    ]
    counts = Counter(wallet["status"] for wallet in wallets)
    node_risk = {wallet["address"]: wallet["risk"] for wallet in wallets}
    global_edges = []
    for cluster in clusters:
        global_edges.extend(spanning_edges(cluster["members"], cluster["edges"], node_risk))
    content = {"wallets": wallets, "clusters": clusters, "global_edges": global_edges}
    return {
        "metadata": {**metadata, "content_hash": canonical_hash(content)},
        "status_counts": {
            "clean": counts["clean"],
            "review": counts["review"],
            "flagged": counts["flagged"],
        },
        **content,
    }


def build_shipped(snapshot: dict) -> dict:
    dataset, config, result = run_analysis(snapshot)
    evidence = project_evidence_edges(dataset, config, result)
    member_families: dict[str, set[str]] = {}
    clusters = []
    display_risk = {row["address"].lower(): "independent" for row in snapshot["raw_list"]}
    cluster_risk = dict(display_risk)
    status = {row["address"].lower(): "clean" for row in snapshot["raw_list"]}
    for cluster in result.clusters:
        edges = strongest_edges(evidence.get(cluster.cluster_id, ()))
        for edge in edges:
            member_families.setdefault(edge["source"], set()).add(edge["family"])
            member_families.setdefault(edge["target"], set()).add(edge["family"])
        reasons = [
            {"family": reason.family, "text": reason.human_string, "strength": reason.strength}
            for reason in cluster.reasons
        ]
        record = cluster_record(
            cluster_id=cluster.cluster_id,
            members=list(cluster.members),
            edges=edges,
            confidence=cluster.confidence,
            reasons=reasons,
            points=cluster.points,
            total_points=result.total_points,
            span_blocks=cluster.span_blocks,
        )
        clusters.append(record)
        for member in cluster.members:
            status[member] = "flagged"
            cluster_risk[member] = record["risk"]
    for member in status:
        if status[member] == "flagged":
            display_risk[member] = (
                "review" if len(member_families.get(member, set())) < 2 else cluster_risk[member]
            )
    return finish_version(
        metadata={
            "id": V1_ID,
            "label": "Published SybilKit 0.1.1",
            "at": "2026-08-22T00:00:00Z",
            "stage": "published",
            "summary": "The original 263-group analysis, preserved exactly.",
            "detector": "sybilkit",
            "detector_version": snapshot["meta"]["sybilkit_version"],
            "detector_commit": DETECTOR_COMMIT,
            "rule_set": "baseline(shipped)",
            "snapshot_block": snapshot["meta"]["snapshot_block"],
            "commit": "88d595b",
            "tag": "v0.1.0",
            "reproduce_command": "uv run python scripts/build_versions.py",
        },
        rows=snapshot["raw_list"],
        clusters=clusters,
        status_by_address=status,
        display_risk_by_address=display_risk,
        cluster_risk_by_address=cluster_risk,
        member_families=member_families,
    )


def build_v2(snapshot: dict) -> dict:
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
    infra = frozenset(
        address.lower()
        for address in json.loads(
            (PROJECT_ROOT / "audit" / "data" / "infra_all.json").read_text()
        )
    )
    rules = replace(sk_v2.VARIANTS[V2_RULE], infra_extra=infra)
    raw_clusters, raw_edges, firsts, _ = sk_v2.run(dataset, config, rules)
    points, total_points = final_points(dataset, config.points_per_eth)

    prepared = []
    for raw in raw_clusters:
        members = sorted(raw["members"])
        member_set = set(members)
        edges = strongest_edges(
            edge for edge in raw_edges if edge.a in member_set and edge.b in member_set
        )
        confidence, reasons = confidence_for(edges, members, dataset, firsts)
        blocks = [firsts[member].block_number for member in members]
        prepared.append(
            {
                "members": members,
                "core": set(raw["core"]),
                "edges": edges,
                "confidence": confidence,
                "reasons": reasons,
                "points": sum(points[member] for member in members),
                "span_blocks": max(blocks) - min(blocks),
            }
        )
    prepared.sort(key=lambda row: (-row["points"], row["members"]))

    status = {row["address"].lower(): "clean" for row in snapshot["raw_list"]}
    display_risk = {address: "independent" for address in status}
    cluster_risk = dict(display_risk)
    member_families: dict[str, set[str]] = {}
    clusters = []
    for cluster_id, raw in enumerate(prepared):
        record = cluster_record(
            cluster_id=cluster_id,
            members=raw["members"],
            edges=raw["edges"],
            confidence=raw["confidence"],
            reasons=raw["reasons"],
            points=raw["points"],
            total_points=total_points,
            span_blocks=raw["span_blocks"],
        )
        clusters.append(record)
        for edge in raw["edges"]:
            member_families.setdefault(edge["source"], set()).add(edge["family"])
            member_families.setdefault(edge["target"], set()).add(edge["family"])
        for member in raw["members"]:
            is_core = member in raw["core"]
            status[member] = "flagged" if is_core else "review"
            cluster_risk[member] = record["risk"]
            display_risk[member] = record["risk"] if is_core else "review"

    return finish_version(
        metadata={
            "id": V2_ID,
            "label": "Audited v2h candidate",
            "at": "2026-08-25T00:00:00Z",
            "stage": "candidate",
            "summary": "Funding-building v2h analysis with a per-member review periphery.",
            "detector": "sybilkit audit harness",
            "detector_version": "v2h prototype",
            "detector_commit": DETECTOR_COMMIT,
            "rules_file": "audit/harness/sk_v2.py",
            "rules_sha256": RULES_SHA256,
            "rule_set": V2_RULE,
            "snapshot_block": snapshot["meta"]["snapshot_block"],
            "commit": "f0a084b",
            "tag": None,
            "reproduce_command": "uv run python scripts/build_versions.py",
        },
        rows=snapshot["raw_list"],
        clusters=clusters,
        status_by_address=status,
        display_risk_by_address=display_risk,
        cluster_risk_by_address=cluster_risk,
        member_families=member_families,
    )


def links(*values: tuple[str, str]) -> list[dict]:
    return [{"label": label, "url": url} for label, url in values]


def transition_summary(base: dict, head: dict) -> str:
    base_by_address = {row["address"]: row for row in base["wallets"]}
    transitions = Counter(
        (base_by_address[row["address"]]["status"], row["status"])
        for row in head["wallets"]
    )
    changed = [
        (base_status, head_status, count)
        for (base_status, head_status), count in sorted(transitions.items())
        if base_status != head_status
    ]
    unchanged = sum(
        count
        for (base_status, head_status), count in transitions.items()
        if base_status == head_status
    )
    parts = [
        f"{count:,} {base_status}→{head_status}"
        for base_status, head_status, count in changed
    ]
    return "; ".join([*parts, f"{unchanged:,} unchanged."])


def build_changelog(snapshot: dict, shipped: dict, candidate: dict) -> list[dict]:
    events = sorted(snapshot["events"], key=lambda row: (row["block_number"], row["log_index"]))
    by_hour = {}
    for event in events:
        by_hour.setdefault(event["hour"], []).append(event)
    first = events[0]
    last = events[-1]
    deployment_ts = first["ts"] - (
        first["block_number"] - snapshot["meta"]["deployment_block"]
    ) * 12
    announcement_ts = first["ts"] + 32.7 * 60 * 60
    entries = [
        {
            "id": "chain-contract-deployed",
            "kind": "chain",
            "at": as_utc(deployment_ts),
            "block": snapshot["meta"]["deployment_block"],
            "title": "WhitelistCurator deployed",
            "summary": "Contract deployment; timestamp derived from the first pinned event.",
            "links": links(
                (
                    "Contract",
                    "https://etherscan.io/address/0xcb0b0531e86a9ac36fa865ca8e3dbccf047fda91#code",
                )
            ),
        },
        {
            "id": "chain-first-deposit",
            "kind": "chain",
            "at": as_utc(first["ts"]),
            "block": first["block_number"],
            "title": "First deposit",
            "summary": "The first wallet entered the immutable onchain list.",
            "links": [],
        },
    ]
    for hour, rows in sorted(by_hour.items()):
        event = rows[0]
        entries.append(
            {
                "id": f"chain-hour-{hour:02d}",
                "kind": "chain",
                "at": as_utc(event["ts"]),
                "block": event["block_number"],
                "title": "Game opened" if hour == 0 else f"Entry extended into hour {hour}",
                "summary": f"{len(rows):,} deposits were recorded in hour {hour}.",
                "links": [],
            }
        )
    for hour, _count in Counter(
        {hour: len(rows) for hour, rows in by_hour.items()}
    ).most_common(5):
        event = by_hour[hour][0]
        entries.append(
            {
                "id": f"chain-wave-{hour:02d}",
                "kind": "chain",
                "at": as_utc(event["ts"]),
                "block": event["block_number"],
                "title": f"Large deposit wave in hour {hour}",
                "summary": (
                    f"{len(by_hour[hour]):,} deposits made this one of the five largest waves."
                ),
                "links": [],
            }
        )
    entries.extend(
        [
            {
                "id": "context-imd-announcement",
                "kind": "context",
                "at": as_utc(announcement_ts),
                "block": None,
                "title": "imd.fun announced during hour 32",
                "summary": (
                    "The project channel linked imd.fun at hour 32.7; the broad hour 34–35 "
                    "community rally followed and is essential context for the published clusters."
                ),
                "links": links(
                    ("Audit context", "https://github.com/banse/clustermap/tree/main/audit")
                ),
            },
            {
                "id": "chain-settled",
                "kind": "chain",
                "at": as_utc(last["ts"]),
                "block": last["block_number"],
                "title": "THE LIST settled",
                "summary": "The last deposit fixed the population at 19,522 wallets.",
                "links": [],
            },
            {
                "id": "chain-snapshot",
                "kind": "chain",
                "at": as_utc(snapshot["meta"]["maxpane_saved_at"]),
                "block": snapshot["meta"]["snapshot_block"],
                "title": "Analysis snapshot pinned",
                "summary": "The final contract population and enrichment inputs were frozen.",
                "links": links(("Snapshot tag", "https://github.com/banse/clustermap/tree/v0.1.0/data")),
            },
            {
                "id": "analysis-shipped",
                "kind": "analysis",
                "at": "2026-08-22T00:00:00Z",
                "block": snapshot["meta"]["snapshot_block"],
                "title": "Original SybilKit analysis published",
                "summary": "263 groups; 11,573 wallets linked by the shipped rules.",
                "version": V1_ID,
                "links": links(
                    ("Tag v0.1.0", "https://github.com/banse/clustermap/tree/v0.1.0"),
                    ("Commit", "https://github.com/banse/clustermap/commit/88d595b"),
                ),
            },
            {
                "id": "publication-presentation-correction",
                "kind": "publication",
                "at": "2026-08-25T10:00:00Z",
                "block": None,
                "title": "Wallet claims narrowed to their own evidence",
                "summary": (
                    "Group-scoped wording, per-member review tiers, edge caps, export caveats, "
                    "and a public dispute route shipped without changing clustering."
                ),
                "links": links(
                    ("Tag v0.2.0", "https://github.com/banse/clustermap/tree/v0.2.0"),
                    ("Commit", "https://github.com/banse/clustermap/commit/236ac57"),
                ),
            },
            {
                "id": "context-audit",
                "kind": "context",
                "at": "2026-08-25T12:00:00Z",
                "block": None,
                "title": "Independent detector audit published",
                "summary": (
                    "The shipped rules were measured against complete enrichment, a null model, "
                    "known operators, and pre-registered independent controls."
                ),
                "links": links(
                    ("Audit", "https://github.com/banse/clustermap/tree/main/audit"),
                ),
            },
            {
                "id": "analysis-v2h",
                "kind": "analysis",
                "at": "2026-08-25T14:00:00Z",
                "block": snapshot["meta"]["snapshot_block"],
                "title": "Audited v2h candidate recorded",
                "summary": (
                    "160 groups; 2,082 shipped members released and 2,925 newly flagged. "
                    f"{transition_summary(shipped, candidate)} "
                    "The review periphery remains visible but is not removed."
                ),
                "version": V2_ID,
                "delta": {"base": V1_ID, "head": V2_ID},
                "links": links(
                    (
                        "Open delta",
                        f"/?page=map&delta=1&base={V1_ID}&head={V2_ID}&version={V2_ID}",
                    ),
                    ("Audit evidence", "https://github.com/banse/clustermap/tree/main/audit"),
                    ("Detector commit", "https://github.com/banse/clustermap/commit/f0a084b"),
                ),
            },
        ]
    )
    return sorted(entries, key=lambda entry: (entry["at"], entry["id"]))


def write_artifact(payload: dict) -> None:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    with OUTPUT.open("wb") as handle:
        with gzip.GzipFile(fileobj=handle, filename="", mode="wb", mtime=0) as compressed:
            compressed.write(raw)


def main() -> None:
    snapshot = read_snapshot()
    shipped = build_shipped(snapshot)
    candidate = build_v2(snapshot)
    payload = {
        "schema_version": 1,
        "generated_at": GENERATED_AT,
        "snapshot_block": snapshot["meta"]["snapshot_block"],
        "published_version": V1_ID,
        "versions": [shipped, candidate],
        "changelog": build_changelog(snapshot, shipped, candidate),
    }
    write_artifact(payload)
    print(
        f"wrote {OUTPUT.relative_to(PROJECT_ROOT)}: "
        f"{len(shipped['wallets']):,} wallets, "
        f"{len(shipped['clusters'])}/{len(candidate['clusters'])} clusters, "
        f"{candidate['status_counts']}"
    )


if __name__ == "__main__":
    main()
