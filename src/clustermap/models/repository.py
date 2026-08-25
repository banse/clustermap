"""In-memory, versioned read model for the settled contract snapshot."""

from __future__ import annotations

import gzip
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from .analysis import load_dataset
from .versions import AnalysisVersion, DeltaClass, VersionStore

ListLink = Literal["all", "linked", "unlinked"]
EvidenceFilter = Literal["all", "high", "low"]
ListPreset = Literal["none", "first1000", "hour0", "whale"]

WHALE_DEPOSIT_WEI = 25 * 10**18
CLUSTER_PUBLIC_FIELDS = (
    "id",
    "size",
    "confidence",
    "band",
    "points",
    "points_share",
    "span_blocks",
    "families",
    "reasons",
    "edge_count",
    "risk",
    "review_flag",
    "review_reasons",
)


class CuratorRepository:
    def __init__(
        self,
        snapshot_path: Path,
        *,
        eth_usd: float | None = None,
        versions_path: Path | None = None,
    ) -> None:
        self.snapshot_path = snapshot_path
        self.eth_usd = eth_usd
        self.snapshot = self._read_snapshot(snapshot_path)
        self.dataset, self.config = load_dataset(self.snapshot)
        self.version_store = VersionStore(
            versions_path or snapshot_path.with_name("analysis_versions.json.gz")
        )

        self.rows = tuple(dict(row) for row in self.snapshot["raw_list"])
        self.rows_by_address = {row["address"].lower(): row for row in self.rows}
        self.whale_addresses = frozenset(
            event["contributor"].lower()
            for event in self.snapshot["events"]
            if int(event["amount_wei"]) >= WHALE_DEPOSIT_WEI
        )
        expected = int(self.snapshot["meta"]["population_count"])
        if len(self.rows) != expected:
            raise ValueError(
                f"snapshot population mismatch: meta={expected}, list={len(self.rows)}"
            )
        expected_addresses = frozenset(self.rows_by_address)
        for version in self.version_store.versions:
            if frozenset(version.wallets_by_address) != expected_addresses:
                raise ValueError(f"version {version.id} population does not match snapshot")
        self._global_maps = {
            version.id: self._build_global_map(version)
            for version in self.version_store.versions
        }

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

    @staticmethod
    def _cluster_summary(cluster: dict) -> dict:
        return {field: cluster[field] for field in CLUSTER_PUBLIC_FIELDS}

    @staticmethod
    def _public_edge(edge: dict) -> dict:
        return {
            field: edge[field]
            for field in ("source", "target", "family", "strength", "reason", "is_transfer")
        }

    def _version(self, version_id: str | None) -> AnalysisVersion:
        return self.version_store.resolve(version_id)

    def _build_global_map(self, version: AnalysisVersion) -> dict:
        nodes = []
        risk_counts = {
            risk: 0 for risk in ("independent", "review", "elevated", "critical")
        }
        for row in self.rows:
            address = row["address"].lower()
            state = version.wallets_by_address[address]
            risk_counts[state["risk"]] += 1
            nodes.append(
                {
                    "id": address,
                    "address": address,
                    "rank": row["rank"],
                    "points": row["points"],
                    "name": row.get("name"),
                    "cluster_id": state["cluster_id"],
                    "status": state["status"],
                    "risk": state["risk"],
                    "cluster_risk": state["cluster_risk"],
                    "member_families": state["member_families"],
                    "review_flag": (
                        version.clusters_by_id[state["cluster_id"]]["review_flag"]
                        if state["cluster_id"] is not None
                        else False
                    ),
                }
            )
        return {
            "version": version.id,
            "nodes": nodes,
            "edges": list(version.global_edges),
            "meta": {
                "node_count": len(nodes),
                "edge_count": len(version.global_edges),
                "status_counts": dict(version.status_counts),
                "risk_counts": risk_counts,
                "review_cluster_count": sum(
                    1 for cluster in version.clusters if cluster["review_flag"]
                ),
                "layout": "points-first deterministic cluster rings",
            },
        }

    def overview(self, version_id: str | None = None) -> dict:
        version = self._version(version_id)
        meta = self.snapshot["meta"]
        linked = version.status_counts["review"] + version.status_counts["flagged"]
        linked_points = sum(
            int(self.rows_by_address[state["address"]]["points"])
            for state in version.wallets
            if state["status"] != "clean"
        )
        return {
            "version": version.public_metadata(
                published=version.id == self.version_store.published_version
            ),
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
                "groups": len(version.clusters),
                "linked_wallets": linked,
                "unlinked_wallets": len(self.rows) - linked,
                "status_counts": dict(version.status_counts),
                "points": sum(int(row["points"]) for row in self.rows),
                "linked_points": linked_points,
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
                "dispute": {
                    "text": (
                        "Every group here is reproducible from published data, and the rules "
                        "have a measured error rate. If this analysis is wrong about a wallet, "
                        "contest it and the evidence can be checked."
                    ),
                    "audit_url": "https://github.com/banse/clustermap/tree/main/audit",
                    "contest_url": (
                        "https://github.com/banse/clustermap/issues/new?labels=dispute"
                    ),
                },
            },
            "clusters": [self._cluster_summary(cluster) for cluster in version.clusters],
        }

    def global_map(self, version_id: str | None = None) -> dict:
        version = self._version(version_id)
        return self._global_maps[version.id]

    def cluster(self, cluster_id: int, version_id: str | None = None) -> dict | None:
        version = self._version(version_id)
        cluster = version.clusters_by_id.get(cluster_id)
        if cluster is None:
            return None
        nodes = []
        for address in cluster["members"]:
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
                    "status": version.wallets_by_address[address]["status"],
                }
            )
        nodes.sort(key=lambda row: (-row["points"], row["rank"]))
        return {
            "version": version.id,
            "cluster": self._cluster_summary(cluster),
            "nodes": nodes,
            "edges": [self._public_edge(edge) for edge in cluster["edges"]],
        }

    def wallet(self, address: str, version_id: str | None = None) -> dict | None:
        key = address.lower()
        row = self.rows_by_address.get(key)
        if row is None:
            return None
        version = self._version(version_id)
        state = version.wallets_by_address[key]
        cluster_id = state["cluster_id"]
        cluster = version.clusters_by_id.get(cluster_id) if cluster_id is not None else None
        edges = cluster["edges"] if cluster is not None else ()
        funding = self.dataset.funding.get(key)
        return {
            "version": version.id,
            "wallet": dict(row),
            "status": "linked" if state["status"] != "clean" else "unlinked",
            "analysis_status": state["status"],
            "cluster": self._cluster_summary(cluster) if cluster is not None else None,
            "member_families": state["member_families"],
            "member_risk": state["risk"],
            "related_edges": [
                self._public_edge(edge)
                for edge in edges
                if key in (edge["source"], edge["target"])
            ][:120],
            "history": self.version_store.wallet_history(key),
            "first_funder": funding.funder if funding is not None else None,
            "explorer_url": f"https://etherscan.io/address/{key}",
            "eth_usd": self.eth_usd,
        }

    def list_rows(
        self,
        *,
        version_id: str | None = None,
        query: str = "",
        link: ListLink = "all",
        evidence: EvidenceFilter = "all",
        preset: ListPreset = "none",
        offset: int = 0,
        limit: int = 50,
    ) -> dict:
        version = self._version(version_id)
        selected = self._select_rows(
            version,
            query=query,
            link=link,
            evidence=evidence,
            preset=preset,
        )
        return {
            "version": version.id,
            "rows": selected[offset : offset + limit],
            "total": len(selected),
            "offset": offset,
            "limit": limit,
        }

    def export_rows(
        self,
        *,
        version_id: str | None = None,
        query: str = "",
        link: ListLink = "all",
        evidence: EvidenceFilter = "all",
        preset: ListPreset = "none",
    ) -> dict:
        version = self._version(version_id)
        rows = self._select_rows(
            version,
            query=query,
            link=link,
            evidence=evidence,
            preset=preset,
        )
        return {
            "source": "CuratorWhitelist",
            "contract": self.snapshot["meta"]["contract"],
            "snapshot_block": self.snapshot["meta"]["snapshot_block"],
            "analysis_version": version.public_metadata(
                published=version.id == self.version_store.published_version
            ),
            "detector": {
                "name": version.metadata["detector"],
                "version": version.metadata["detector_version"],
                "rule_set": version.metadata["rule_set"],
                "generated_at": self._as_utc(datetime.now(tz=UTC).timestamp()),
            },
            "caveats": [
                "A group is an analysis signal, not proof of common ownership.",
                "`status` is the standing under the named immutable analysis version; "
                "different versions can and do disagree.",
                "`member_families` lists evidence incident on the wallet itself. The shipped "
                "v0.1 state predates the presentation gate, so `under_review` can qualify a "
                "historical flagged status without rewriting it.",
                "Full audit, evidence and reproduction: "
                "https://github.com/banse/clustermap/tree/main/audit",
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
        version: AnalysisVersion,
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
            state = version.wallets_by_address[address]
            is_linked = state["status"] != "clean"
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
            cluster = (
                version.clusters_by_id[state["cluster_id"]]
                if state["cluster_id"] is not None
                else None
            )
            if evidence != "all" and (cluster is None or cluster["band"] != evidence):
                continue
            name = (source.get("name") or "").lower()
            if needle and needle not in address and needle not in name:
                continue
            row = dict(source)
            row.update(
                {
                    "version": version.id,
                    "cluster_id": state["cluster_id"],
                    "status": state["status"],
                    "risk": state["risk"],
                    "evidence_band": cluster["band"] if cluster is not None else "none",
                    "member_families": state["member_families"],
                    "member_family_count": len(state["member_families"]),
                    "under_review": is_linked and state["risk"] == "review",
                }
            )
            selected.append(row)
        return selected

    def versions(self) -> dict:
        return self.version_store.list_versions()

    def version(self, version_id: str) -> dict:
        return self.version_store.version_detail(version_id)

    def changelog(
        self,
        *,
        kind: str | None,
        from_at: str | None,
        to_at: str | None,
    ) -> dict:
        return self.version_store.changelog(kind=kind, from_at=from_at, to_at=to_at)

    def delta(self, base_id: str, head_id: str) -> dict:
        return self.version_store.compare(base_id, head_id)

    def delta_wallets(
        self,
        base_id: str,
        head_id: str,
        *,
        delta_filter: DeltaClass | None,
        offset: int,
        limit: int,
    ) -> dict:
        rows = self.version_store.comparison_rows(
            base_id, head_id, delta_filter=delta_filter
        )
        enriched = []
        for value in rows[offset : offset + limit]:
            source = self.rows_by_address[value["address"]]
            enriched.append(
                {
                    "address": value["address"],
                    "rank": source["rank"],
                    "points": source["points"],
                    "name": source.get("name"),
                    "class": value["class"],
                    "base": value["base"],
                    "head": value["head"],
                }
            )
        return {
            "base": base_id,
            "head": head_id,
            "class": delta_filter,
            "rows": enriched,
            "total": len(rows),
            "offset": offset,
            "limit": limit,
        }

    def health(self) -> dict:
        published = self._version(None)
        return {
            "status": "ready",
            "snapshot": "loaded",
            "analysis": "versioned",
            "population": len(self.rows),
            "groups": len(published.clusters),
            "published_version": published.id,
            "versions": len(self.version_store.versions),
        }
