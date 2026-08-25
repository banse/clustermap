"""Small immutable records shared by the analysis and API layers."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EvidenceEdge:
    source: str
    target: str
    family: str
    strength: float
    reason: str
    is_transfer: bool

    def as_dict(self) -> dict:
        return {
            "source": self.source,
            "target": self.target,
            "family": self.family,
            "strength": self.strength,
            "reason": self.reason,
            "is_transfer": self.is_transfer,
        }


def evidence_band(families: set[str]) -> str:
    """Match MaxPane's evidence-structure bands without inventing a verdict."""
    return "high" if "funding" in families or len(families) >= 3 else "low"

