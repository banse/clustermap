"""SybilKit adapter and evidence-edge projection."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from sybilkit import Dataset, DetectConfig, detect
from sybilkit.signals import first_rows, identical_amount_windows, single_first_rows
from sybilkit.signals.amounts import amount_edges
from sybilkit.signals.cadence import cadence_edges
from sybilkit.signals.funding import funding_edges
from sybilkit.signals.gas import gas_edges
from sybilkit.signals.sequence import sequence_edges
from sybilkit.signals.split import split_edges

from .domain import EvidenceEdge


def run_analysis(snapshot: dict):
    enrichment = snapshot["enrichment"]
    dataset = Dataset.from_events(
        snapshot["events"],
        snapshot["first_deposits"],
        txs=enrichment.get("txs"),
        funding=enrichment.get("funding"),
    )
    analysis_config = snapshot["analysis_config"]
    config = DetectConfig(
        points_per_eth=int(analysis_config["points_per_eth"]),
        protocol_min_amount_wei=int(analysis_config["min_deposit_wei"]),
    )
    return dataset, config, detect(dataset, config)


def project_evidence_edges(dataset, config, result) -> dict[int, tuple[EvidenceEdge, ...]]:
    """Return SybilKit's typed links grouped by kept cluster.

    Funding-family links are literal first-funder transfers. Every other family
    is behavioural evidence and remains explicitly marked as non-transfer.
    """
    firsts = first_rows(dataset)
    windows = identical_amount_windows(
        dataset,
        config,
        singles=single_first_rows(dataset, firsts=firsts),
    )
    raw_edges = []
    raw_edges.extend(amount_edges(dataset, config, firsts=firsts, windows=windows))
    raw_edges.extend(split_edges(dataset, config, windows=windows))
    raw_edges.extend(sequence_edges(dataset, config, firsts=firsts))
    raw_edges.extend(cadence_edges(dataset, config, firsts=firsts))

    groups = [set(cluster.members) for cluster in result.clusters]
    raw_edges.extend(gas_edges(dataset, config, groups=groups, firsts=firsts))
    raw_edges.extend(funding_edges(dataset, config, groups=groups))

    member_to_cluster = {
        member: cluster.cluster_id
        for cluster in result.clusters
        for member in cluster.members
    }
    strongest: dict[tuple[int, str, str, str], EvidenceEdge] = {}
    for edge in raw_edges:
        source, target = sorted((edge.a.lower(), edge.b.lower()))
        cluster_id = member_to_cluster.get(source)
        if cluster_id is None or member_to_cluster.get(target) != cluster_id:
            continue
        projected = EvidenceEdge(
            source=source,
            target=target,
            family=edge.family,
            strength=edge.strength,
            reason=edge.reason.human_string,
            is_transfer=edge.family == "funding",
        )
        key = (cluster_id, source, target, edge.family)
        current = strongest.get(key)
        if current is None or projected.strength > current.strength:
            strongest[key] = projected

    by_cluster: dict[int, list[EvidenceEdge]] = defaultdict(list)
    for (cluster_id, *_), edge in strongest.items():
        by_cluster[cluster_id].append(edge)
    return {
        cluster_id: tuple(
            sorted(edges, key=lambda edge: (edge.family, edge.source, edge.target))
        )
        for cluster_id, edges in by_cluster.items()
    }


def related_edges(edges: Iterable[EvidenceEdge], address: str, limit: int = 120) -> list[dict]:
    key = address.lower()
    return [edge.as_dict() for edge in edges if key in (edge.source, edge.target)][:limit]

