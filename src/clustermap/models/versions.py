"""Immutable analysis versions and pure comparisons between them."""

from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

WalletStatus = Literal["clean", "review", "flagged"]
DeltaClass = Literal["improved", "worsened", "under_review", "unchanged"]

STATUS_ORDER: tuple[WalletStatus, ...] = ("clean", "review", "flagged")
RISK_ORDER = ("independent", "review", "elevated", "critical")


def canonical_hash(value: object) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def weakest_risk(*risks: str) -> str:
    return min(
        risks,
        key=lambda risk: RISK_ORDER.index(risk) if risk in RISK_ORDER else len(RISK_ORDER),
    )


def assess_cluster(
    confidence: float,
    families: set[str],
    size: int,
) -> tuple[str, list[str]]:
    if confidence >= 0.95 and "funding" in families and len(families) >= 3:
        risk = "critical"
    elif confidence >= 0.80 and ("funding" in families or len(families) >= 3):
        risk = "elevated"
    else:
        risk = "review"

    review_reasons = []
    if "funding" not in families:
        review_reasons.append("Behavioural evidence only; no measured funding transfer")
    if confidence < 0.80:
        review_reasons.append("Model confidence below 80%")
    if size >= 500 and confidence < 0.90:
        review_reasons.append("Broad group with below 90% confidence")
    return risk, review_reasons


def delta_class(base: WalletStatus, head: WalletStatus) -> DeltaClass:
    if base == head:
        return "unchanged"
    if head == "review":
        return "under_review"
    if STATUS_ORDER.index(head) < STATUS_ORDER.index(base):
        return "improved"
    return "worsened"


@dataclass(slots=True)
class AnalysisVersion:
    metadata: dict
    status_counts: dict[str, int]
    wallets: tuple[dict, ...]
    clusters: tuple[dict, ...]
    global_edges: tuple[dict, ...]
    wallets_by_address: dict[str, dict] = field(init=False, repr=False)
    clusters_by_id: dict[int, dict] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.wallets_by_address = {row["address"]: row for row in self.wallets}
        self.clusters_by_id = {row["id"]: row for row in self.clusters}

    @property
    def id(self) -> str:
        return str(self.metadata["id"])

    def public_metadata(self, *, published: bool) -> dict:
        return {
            **self.metadata,
            "published": published,
            "status_counts": dict(self.status_counts),
            "cluster_count": len(self.clusters),
        }


class VersionStore:
    """Validated, append-only versions loaded from one deterministic artifact."""

    def __init__(self, artifact_path: Path) -> None:
        self.artifact_path = artifact_path
        try:
            with gzip.open(artifact_path, "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"analysis versions not found at {artifact_path}; "
                "run 'UV_CACHE_DIR=/tmp/clustermap-uv-cache uv run python "
                "scripts/build_versions.py'"
            ) from exc
        if payload.get("schema_version") != 1:
            raise ValueError("unsupported analysis-version schema")

        self.generated_at = str(payload["generated_at"])
        self.snapshot_block = int(payload["snapshot_block"])
        self.published_version = str(payload["published_version"])
        self.changelog_entries = tuple(payload["changelog"])
        self.versions = tuple(
            AnalysisVersion(
                metadata=dict(value["metadata"]),
                status_counts=dict(value["status_counts"]),
                wallets=tuple(value["wallets"]),
                clusters=tuple(value["clusters"]),
                global_edges=tuple(value["global_edges"]),
            )
            for value in payload["versions"]
        )
        self.by_id = {version.id: version for version in self.versions}
        self._validate(payload)

    def _validate(self, payload: dict) -> None:
        if len(self.by_id) != len(self.versions):
            raise ValueError("duplicate analysis-version id")
        if self.published_version not in self.by_id:
            raise ValueError("published analysis version is missing")

        population = len(self.versions[0].wallets) if self.versions else 0
        for version, raw in zip(self.versions, payload["versions"], strict=True):
            if len(version.wallets) != population:
                raise ValueError(f"version {version.id} population mismatch")
            if len(version.wallets_by_address) != population:
                raise ValueError(f"version {version.id} has duplicate wallet rows")
            if len(version.clusters_by_id) != len(version.clusters):
                raise ValueError(f"version {version.id} has duplicate cluster ids")
            actual_counts = {status: 0 for status in STATUS_ORDER}
            for wallet in version.wallets:
                status = wallet.get("status")
                if status not in STATUS_ORDER:
                    raise ValueError(f"version {version.id} has invalid status {status!r}")
                actual_counts[status] += 1
                cluster_id = wallet.get("cluster_id")
                if cluster_id is not None and cluster_id not in version.clusters_by_id:
                    raise ValueError(
                        f"version {version.id} wallet references missing cluster {cluster_id}"
                    )
            if actual_counts != version.status_counts:
                raise ValueError(f"version {version.id} status counts do not match rows")
            content = {
                "wallets": raw["wallets"],
                "clusters": raw["clusters"],
                "global_edges": raw["global_edges"],
            }
            if canonical_hash(content) != version.metadata.get("content_hash"):
                raise ValueError(f"version {version.id} content hash mismatch")

    def resolve(self, version_id: str | None = None) -> AnalysisVersion:
        key = version_id or self.published_version
        try:
            return self.by_id[key]
        except KeyError as exc:
            raise KeyError(f"unknown analysis version: {key}") from exc

    def list_versions(self) -> dict:
        return {
            "published_version": self.published_version,
            "versions": [
                version.public_metadata(published=version.id == self.published_version)
                for version in self.versions
            ],
        }

    def version_detail(self, version_id: str) -> dict:
        version = self.resolve(version_id)
        return version.public_metadata(published=version.id == self.published_version)

    def changelog(
        self,
        *,
        kind: str | None = None,
        from_at: str | None = None,
        to_at: str | None = None,
    ) -> dict:
        entries = [
            entry
            for entry in self.changelog_entries
            if (kind is None or entry["kind"] == kind)
            and (from_at is None or entry["at"] >= from_at)
            and (to_at is None or entry["at"] <= to_at)
        ]
        entries.sort(key=lambda entry: (entry["at"], entry["id"]), reverse=True)
        return {
            "entries": entries,
            "total": len(entries),
            "filters": {"kind": kind, "from": from_at, "to": to_at},
        }

    def wallet_history(self, address: str) -> list[dict]:
        key = address.lower()
        return [
            {
                "version": version.id,
                "label": version.metadata["label"],
                "at": version.metadata["at"],
                **version.wallets_by_address[key],
            }
            for version in self.versions
            if key in version.wallets_by_address
        ]

    def compare(self, base_id: str, head_id: str) -> dict:
        base = self.resolve(base_id)
        head = self.resolve(head_id)
        classes: list[DeltaClass] = []
        counts: dict[DeltaClass, int] = {
            "improved": 0,
            "worsened": 0,
            "under_review": 0,
            "unchanged": 0,
        }
        transitions: dict[str, int] = {}
        by_address: dict[str, DeltaClass] = {}
        for state in head.wallets:
            address = state["address"]
            base_status = base.wallets_by_address[address]["status"]
            head_status = state["status"]
            value = delta_class(base_status, head_status)
            classes.append(value)
            counts[value] += 1
            by_address[address] = value
            transition = f"{base_status}->{head_status}"
            transitions[transition] = transitions.get(transition, 0) + 1

        base_cluster_by_member = {
            member: cluster["id"] for cluster in base.clusters for member in cluster["members"]
        }
        head_members = {member for cluster in head.clusters for member in cluster["members"]}
        head_clusters = []
        for cluster in head.clusters:
            mix = {name: 0 for name in counts}
            overlaps: dict[int, int] = {}
            for member in cluster["members"]:
                mix[by_address[member]] += 1
                base_cluster_id = base_cluster_by_member.get(member)
                if base_cluster_id is not None:
                    overlaps[base_cluster_id] = overlaps.get(base_cluster_id, 0) + 1
            head_clusters.append(
                {
                    "id": cluster["id"],
                    "size": cluster["size"],
                    "class_counts": mix,
                    "base_clusters": [
                        {"id": cluster_id, "overlap": overlap}
                        for cluster_id, overlap in sorted(
                            overlaps.items(), key=lambda item: (-item[1], item[0])
                        )
                    ],
                    "is_new": not overlaps,
                }
            )

        dissolved = []
        for cluster in base.clusters:
            retained = sum(1 for member in cluster["members"] if member in head_members)
            if retained == 0:
                dissolved.append(
                    {"id": cluster["id"], "size": cluster["size"], "points": cluster["points"]}
                )

        return {
            "base": base.public_metadata(published=base.id == self.published_version),
            "head": head.public_metadata(published=head.id == self.published_version),
            "counts": counts,
            "transitions": transitions,
            "released": sum(
                1
                for state in head.wallets
                if base.wallets_by_address[state["address"]]["status"] == "flagged"
                and state["status"] != "flagged"
            ),
            "newly_flagged": sum(
                1
                for state in head.wallets
                if base.wallets_by_address[state["address"]]["status"] != "flagged"
                and state["status"] == "flagged"
            ),
            "wallet_classes": classes,
            "head_clusters": head_clusters,
            "dissolved_clusters": dissolved,
        }

    def comparison_rows(
        self,
        base_id: str,
        head_id: str,
        *,
        delta_filter: DeltaClass | None,
    ) -> list[dict]:
        base = self.resolve(base_id)
        head = self.resolve(head_id)
        rows = []
        for head_state in head.wallets:
            address = head_state["address"]
            base_state = base.wallets_by_address[address]
            value = delta_class(base_state["status"], head_state["status"])
            if delta_filter is not None and value != delta_filter:
                continue
            rows.append(
                {
                    "address": address,
                    "class": value,
                    "base": dict(base_state),
                    "head": dict(head_state),
                }
            )
        return rows
