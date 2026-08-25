"""In-memory read model for the contract snapshot and SybilKit analysis."""

from __future__ import annotations

import gzip
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from .analysis import project_evidence_edges, related_edges, run_analysis
from .domain import evidence_band

ListLink = Literal["all", "linked", "unlinked"]
EvidenceFilter = Literal["all", "high", "low"]
ListPreset = Literal["none", "first1000", "hour0", "whale"]

WHALE_DEPOSIT_WEI = 25 * 10**18

#: Evidence tiers, weakest first. Used to cap an edge at its weaker endpoint.
RISK_ORDER = ("independent", "review", "elevated", "critical")


def _weakest(*risks: str) -> str:
    return min(risks, key=lambda r: RISK_ORDER.index(r) if r in RISK_ORDER else len(RISK_ORDER))


class CuratorRepository:
    def __init__(self, snapshot_path: Path, *, eth_usd: float | None = None) -> None:
        self.snapshot_path = snapshot_path
        self.eth_usd = eth_usd
        self.snapshot = self._read_snapshot(snapshot_path)
        self.dataset, self.config, self.result = run_analysis(self.snapshot)
        self.evidence = project_evidence_edges(self.dataset, self.config, self.result)

        self.rows = tuple(dict(row) for row in self.snapshot["raw_list"])
        self.rows_by_address = {row["address"].lower(): row for row in self.rows}
        self.whale_addresses = frozenset(
            event["contributor"].lower()
            for event in self.snapshot["events"]
            if int(event["amount_wei"]) >= WHALE_DEPOSIT_WEI
        )
        self.clusters_by_id = {cluster.cluster_id: cluster for cluster in self.result.clusters}
        self.member_to_cluster = {
            member: cluster.cluster_id
            for cluster in self.result.clusters
            for member in cluster.members
        }
        self.member_families = self._build_member_families()
        self._global_map = self._build_global_map()

        expected = int(self.snapshot["meta"]["population_count"])
        if len(self.rows) != expected or len(self.result.analyzed) != expected:
            raise ValueError(
                f"snapshot population mismatch: meta={expected}, "
                f"list={len(self.rows)}, analyzed={len(self.result.analyzed)}"
            )

    @staticmethod
    def _read_snapshot(path: Path) -> dict:
        try:
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                value = json.load(handle)
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"snapshot not found at {path}; run 'uv run python scripts/export_snapshot.py'"
            ) from exc
        if not isinstance(value, dict) or value.get("schema_version") != 1:
            raise ValueError("unsupported curator snapshot schema")
        return value

    @staticmethod
    def _as_utc(value: float) -> str:
        return datetime.fromtimestamp(value, tz=UTC).isoformat().replace("+00:00", "Z")

    def _cluster_summary(self, cluster) -> dict:
        families = {reason.family for reason in cluster.reasons}
        risk, review_reasons = self._cluster_assessment(cluster, families)
        return {
            "id": cluster.cluster_id,
            "size": cluster.size,
            "confidence": cluster.confidence,
            "band": evidence_band(families),
            "points": cluster.points,
            "points_share": cluster.points_share,
            "span_blocks": cluster.span_blocks,
            "families": sorted(families),
            "reasons": [
                {
                    "family": reason.family,
                    "text": reason.human_string,
                    "strength": reason.strength,
                }
                for reason in cluster.reasons
            ],
            "edge_count": len(self.evidence.get(cluster.cluster_id, ())),
            "risk": risk,
            "review_flag": bool(review_reasons),
            "review_reasons": review_reasons,
        }

    def _build_member_families(self) -> dict[str, frozenset[str]]:
        """Which evidence families actually touch each wallet.

        A cluster's tier is a property of the cluster. Membership alone does not
        mean a wallet carries the evidence the tier was assigned for: an audit of
        this snapshot found members held by a single rule of a single family
        sitting in the top tier, on cluster reasons that were false for them
        specifically. See `audit/`.
        """
        families: dict[str, set[str]] = {}
        for edges in self.evidence.values():
            for edge in edges:
                families.setdefault(edge.source, set()).add(edge.family)
                families.setdefault(edge.target, set()).add(edge.family)
        return {address: frozenset(value) for address, value in families.items()}

    def _member_risk(self, address: str, cluster_risk: str) -> str:
        """A wallet's own tier: never stronger than its own evidence supports.

        Fewer than two incident families is exactly the threshold the cluster
        gate itself uses, applied per member instead of per group. Such a wallet
        is shown for review rather than inheriting its cluster's verdict.
        """
        if cluster_risk == "independent":
            return cluster_risk
        if len(self.member_families.get(address, ())) < 2:
            return "review"
        return cluster_risk

    @staticmethod
    def _cluster_assessment(cluster, families: set[str]) -> tuple[str, list[str]]:
        if cluster.confidence >= 0.95 and "funding" in families and len(families) >= 3:
            risk = "critical"
        elif cluster.confidence >= 0.80 and ("funding" in families or len(families) >= 3):
            risk = "elevated"
        else:
            risk = "review"

        review_reasons = []
        if "funding" not in families:
            review_reasons.append("Behavioural evidence only; no measured funding transfer")
        if cluster.confidence < 0.80:
            review_reasons.append("Model confidence below 80%")
        if cluster.size >= 500 and cluster.confidence < 0.90:
            review_reasons.append("Broad group with below 90% confidence")
        return risk, review_reasons

    def _spanning_edges(self, cluster) -> list:
        parent = {member: member for member in cluster.members}

        def root(address: str) -> str:
            while parent[address] != address:
                parent[address] = parent[parent[address]]
                address = parent[address]
            return address

        selected = []
        candidates = sorted(
            self.evidence.get(cluster.cluster_id, ()),
            key=lambda edge: (edge.is_transfer, edge.strength, edge.family),
            reverse=True,
        )
        for edge in candidates:
            source_root = root(edge.source)
            target_root = root(edge.target)
            if source_root == target_root:
                continue
            parent[source_root] = target_root
            selected.append(edge)
            if len(selected) == cluster.size - 1:
                break
        if len(selected) != cluster.size - 1:
            raise ValueError(f"cluster {cluster.cluster_id} evidence graph is disconnected")
        return selected

    def _build_global_map(self) -> dict:
        summaries = {
            cluster.cluster_id: self._cluster_summary(cluster)
            for cluster in self.result.clusters
        }
        nodes = []
        for row in self.rows:
            address = row["address"].lower()
            cluster_id = self.member_to_cluster.get(address)
            summary = summaries.get(cluster_id) if cluster_id is not None else None
            nodes.append(
                {
                    "id": address,
                    "address": address,
                    "rank": row["rank"],
                    "points": row["points"],
                    "name": row.get("name"),
                    "cluster_id": cluster_id,
                    "risk": (
                        self._member_risk(address, summary["risk"])
                        if summary is not None
                        else "independent"
                    ),
                    "cluster_risk": summary["risk"] if summary is not None else "independent",
                    "member_families": sorted(self.member_families.get(address, ())),
                    "review_flag": summary["review_flag"] if summary is not None else False,
                }
            )

        node_risk = {node["address"]: node["risk"] for node in nodes}
        edges = []
        for cluster in self.result.clusters:
            risk = summaries[cluster.cluster_id]["risk"]
            for edge in self._spanning_edges(cluster):
                edges.append(
                    {
                        "source": edge.source,
                        "target": edge.target,
                        "family": edge.family,
                        "strength": edge.strength,
                        # No link is drawn stronger than the wallets it joins.
                        # The cluster's tier is a property of the group; once a
                        # member is capped at "review" by its own evidence, an
                        # edge still drawn at the group's tier claims more about
                        # that pair than anything measured about them supports —
                        # and renders as a red line between two yellow dots.
                        "risk": _weakest(
                            risk,
                            node_risk.get(edge.source, risk),
                            node_risk.get(edge.target, risk),
                        ),
                        "cluster_risk": risk,
                    }
                )

        risk_counts = {risk: 0 for risk in ("independent", "review", "elevated", "critical")}
        for node in nodes:
            risk_counts[node["risk"]] += 1
        return {
            "nodes": nodes,
            "edges": edges,
            "meta": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "risk_counts": risk_counts,
                "review_cluster_count": sum(
                    1 for summary in summaries.values() if summary["review_flag"]
                ),
                "layout": "points-first deterministic cluster rings",
            },
        }

    def overview(self) -> dict:
        linked_count = len(self.member_to_cluster)
        meta = self.snapshot["meta"]
        return {
            "provenance": {
                "chain_id": meta["chain_id"],
                "chain_name": meta["chain_name"],
                "contract": meta["contract"],
                "deployment_block": meta["deployment_block"],
                "snapshot_block": meta["snapshot_block"],
                "snapshot_at": self._as_utc(meta["maxpane_saved_at"]),
                "sybilkit_version": meta["sybilkit_version"],
                "sybilkit_revision": meta["sybilkit_revision"],
            },
            "totals": {
                "population": len(self.rows),
                "deposits": len(self.dataset.deposits),
                "groups": len(self.result.clusters),
                "linked_wallets": linked_count,
                "unlinked_wallets": len(self.rows) - linked_count,
                "points": self.result.total_points,
                "linked_points": self.result.flagged_points,
                "tx_fingerprints": len(self.dataset.txs),
                "funding_rows": len(self.dataset.funding),
            },
            "analysis": {
                "min_size": self.config.min_size,
                "min_families": self.config.min_families,
                "points_per_eth": self.config.points_per_eth,
                "min_deposit_wei": self.config.protocol_min_amount_wei,
                "eth_usd": self.eth_usd,
                "disclaimer": (
                    "Evidence links indicate shared onchain patterns. Only funding links "
                    "represent transfers; no link proves common ownership."
                ),
                # A page that names addresses has to say how to contest what it
                # says about them. The evidence is published and recomputable,
                # so a dispute can be checked by anyone rather than adjudicated
                # in private.
                "dispute": {
                    "text": (
                        "Every group here is reproducible from published data, and the rules "
                        "have a measured error rate. If this analysis is wrong about a wallet, "
                        "contest it and the evidence can be checked."
                    ),
                    "audit_url": "https://github.com/banse/clustermap/tree/main/audit",
                    "contest_url": "https://github.com/banse/clustermap/issues/new?labels=dispute",
                },
            },
            "clusters": [self._cluster_summary(cluster) for cluster in self.result.clusters],
        }

    def global_map(self) -> dict:
        return self._global_map

    def cluster(self, cluster_id: int) -> dict | None:
        cluster = self.clusters_by_id.get(cluster_id)
        if cluster is None:
            return None
        nodes = []
        for address in cluster.members:
            row = self.rows_by_address[address]
            nodes.append(
                {
                    "id": address,
                    "address": address,
                    "rank": row["rank"],
                    "points": row["points"],
                    "credit_eth": row["credit_eth"],
                    "weight_eth": row["weight_eth"],
                    "tx_count": row["tx_count"],
                    "first_hour": row["first_hour"],
                    "first_index": row["first_index"],
                    "name": row.get("name"),
                }
            )
        nodes.sort(key=lambda row: (-row["points"], row["rank"]))
        return {
            "cluster": self._cluster_summary(cluster),
            "nodes": nodes,
            "edges": [edge.as_dict() for edge in self.evidence.get(cluster_id, ())],
        }

    def wallet(self, address: str) -> dict | None:
        key = address.lower()
        row = self.rows_by_address.get(key)
        if row is None:
            return None
        cluster_id = self.member_to_cluster.get(key)
        cluster = self.clusters_by_id.get(cluster_id) if cluster_id is not None else None
        edges = self.evidence.get(cluster_id, ()) if cluster_id is not None else ()
        funding = self.dataset.funding.get(key)
        summary = self._cluster_summary(cluster) if cluster is not None else None
        own = sorted(self.member_families.get(key, ()))
        return {
            "wallet": dict(row),
            "status": "linked" if cluster is not None else "unlinked",
            "cluster": summary,
            "member_families": own,
            "member_risk": (
                self._member_risk(key, summary["risk"]) if summary is not None else "independent"
            ),
            "related_edges": related_edges(edges, key),
            "first_funder": funding.funder if funding is not None else None,
            "explorer_url": f"https://etherscan.io/address/{key}",
            "eth_usd": self.eth_usd,
        }

    def list_rows(
        self,
        *,
        query: str = "",
        link: ListLink = "all",
        evidence: EvidenceFilter = "all",
        preset: ListPreset = "none",
        offset: int = 0,
        limit: int = 50,
    ) -> dict:
        selected = self._select_rows(
            query=query,
            link=link,
            evidence=evidence,
            preset=preset,
        )
        page = selected[offset : offset + limit]
        return {
            "rows": page,
            "total": len(selected),
            "offset": offset,
            "limit": limit,
        }

    def export_rows(
        self,
        *,
        query: str = "",
        link: ListLink = "all",
        evidence: EvidenceFilter = "all",
        preset: ListPreset = "none",
    ) -> dict:
        rows = self._select_rows(
            query=query,
            link=link,
            evidence=evidence,
            preset=preset,
        )
        return {
            "source": "CuratorWhitelist",
            "contract": self.snapshot["meta"]["contract"],
            "snapshot_block": self.snapshot["meta"]["snapshot_block"],
            # An export outlives the page it came from: it gets forked, mirrored
            # and cited long after anyone remembers what it was. So it carries
            # what it is, when it was made, and what is known to be wrong with
            # it — a bare `flagged` column with no provenance is the one artifact
            # that can do real damage on its own.
            "detector": {
                "name": "sybilkit",
                "version": self.snapshot["meta"].get("sybilkit_version"),
                "generated_at": self._as_utc(datetime.now(tz=UTC).timestamp()),
            },
            "caveats": [
                "A group is an analysis signal, not proof of common ownership.",
                "`flagged` is cluster membership under sybilkit's shipped rules. An audit of"
                " these rules measured a 45.8% link rate on a synthetic population containing"
                " no operators at all, and found one operator of 419 wallets (15.6% of all"
                " points) of which only 81 are flagged.",
                "`member_families` counts the evidence families incident on the wallet itself."
                " Fewer than two means the wallet is held in its group by a single family and"
                " should be treated as under review, not as a verdict.",
                "Full audit, evidence and reproduction:"
                " https://github.com/banse/clustermap/tree/main/audit",
            ],
            "filters": {
                "query": query,
                "link": link,
                "evidence": evidence,
                "preset": preset,
            },
            "count": len(rows),
            "rows": rows,
        }

    def _select_rows(
        self,
        *,
        query: str,
        link: ListLink,
        evidence: EvidenceFilter,
        preset: ListPreset,
    ) -> list[dict]:
        needle = query.strip().lower()
        selected = []
        for source in self.rows:
            address = source["address"].lower()
            cluster_id = self.member_to_cluster.get(address)
            is_linked = cluster_id is not None
            if preset == "first1000" and not 1 <= int(source["first_index"]) <= 1000:
                continue
            if preset == "hour0" and int(source["first_hour"]) != 0:
                continue
            if preset == "whale" and address not in self.whale_addresses:
                continue
            if link == "linked" and not is_linked:
                continue
            if link == "unlinked" and is_linked:
                continue
            if evidence != "all":
                if cluster_id is None:
                    continue
                cluster = self.clusters_by_id[cluster_id]
                band = evidence_band({reason.family for reason in cluster.reasons})
                if band != evidence:
                    continue
            name = (source.get("name") or "").lower()
            if needle and needle not in address and needle not in name:
                continue
            row = dict(source)
            row["cluster_id"] = cluster_id
            if cluster_id is not None:
                cluster = self.clusters_by_id[cluster_id]
                row["evidence_band"] = evidence_band(
                    {reason.family for reason in cluster.reasons}
                )
            else:
                row["evidence_band"] = "none"
            # What holds THIS wallet, so a downstream consumer can tell a member
            # carried by one rule from one the whole cluster's evidence covers.
            own = sorted(self.member_families.get(address, ()))
            row["member_families"] = own
            row["member_family_count"] = len(own)
            row["under_review"] = is_linked and len(own) < 2
            selected.append(row)
        return selected

    def health(self) -> dict:
        return {
            "status": "ready",
            "snapshot": "loaded",
            "analysis": "ready",
            "population": len(self.rows),
            "groups": len(self.result.clusters),
        }
