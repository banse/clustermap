"""Stable presentation names for immutable SybilKit evidence edges."""

from __future__ import annotations

EVIDENCE_RULE_LABELS = {
    "identical-odd-amount": "Identical odd amount",
    "identical-amount-wave": "Identical amount wave",
    "equal-split": "Equal split",
    "near-same-block": "Near-same-block amounts",
    "consecutive-joins": "Consecutive joins",
    "repeated-block-burst": "Repeated block burst",
    "metronomic-drip": "Metronomic drip",
    "jitter-engine": "Jitter engine",
    "sub-cent-residual": "Sub-cent residual",
    "deposit-ladder": "Deposit ladder",
    "fresh-funder-hub": "Fresh funder hub",
    "exchange-fan-out": "Exchange fan-out",
    "tight-peel-chain": "Tight peel chain",
    "peel-chain": "Peel chain",
    "shared-first-funder": "Shared first funder",
    "fee-fingerprint": "Fee fingerprint",
    "single-axis-gas": "Single collapsed gas axis",
    "gas-limit-priority-fee": "Gas limit + priority fee",
}


def classify_evidence_rule(family: str, reason: str) -> dict[str, str]:
    """Return the conceptual rule represented by one published edge."""
    if family == "funding" and reason.startswith(
        "first funder is a member of the same cluster (peel chain) · tight:"
    ):
        return _annotation("tight-peel-chain")
    if family == "cadence" and reason.startswith("peel cadence:"):
        return _annotation("tight-peel-chain")
    if family == "amount" and reason.startswith("jitter band:"):
        return _annotation("jitter-engine")
    if family == "cadence" and reason.startswith("engine pocket:"):
        return _annotation("jitter-engine")
    if family == "funding" and reason.startswith("fresh hub:"):
        return _annotation("fresh-funder-hub")
    if family == "cadence" and reason.startswith("fresh-hub cadence:"):
        return _annotation("fresh-funder-hub")
    if family == "funding" and reason.startswith("exchange fan-out:"):
        return _annotation("exchange-fan-out")
    if family == "gas" and reason.startswith("one priority fee ("):
        return _annotation("exchange-fan-out")

    if family == "amount":
        if reason.startswith("≈ W/k equal split:"):
            return _annotation("equal-split")
        if reason.startswith("near-identical "):
            return _annotation("near-same-block")
        if reason.startswith("identical sub-cent residual "):
            return _annotation("sub-cent-residual")
        if reason.startswith("identical ") and "-step ladder " in reason:
            return _annotation("deposit-ladder")
        if reason.startswith("identical odd "):
            return _annotation("identical-odd-amount")
        if reason.startswith("identical "):
            return _annotation("identical-amount-wave")
    if family == "sequence" and reason.startswith("consecutive join indices "):
        return _annotation("consecutive-joins")
    if family == "cadence":
        if reason.startswith("burst "):
            return _annotation("repeated-block-burst")
        if reason.startswith("metronomic drip "):
            return _annotation("metronomic-drip")
    if family == "funding":
        if reason.startswith("first funder is a member of the same cluster"):
            return _annotation("peel-chain")
        if reason.startswith("shared first funder "):
            return _annotation("shared-first-funder")
    if family == "gas":
        if reason.startswith("one fee fingerprint across "):
            return _annotation("fee-fingerprint")
        if reason.startswith("one gas limit + ≤2 priority fees across "):
            return _annotation("gas-limit-priority-fee")
        # The one-axis rule names whichever axis collapsed, so the axis word
        # varies: "one max priority fee value across ×24 (...)", "one gas limit
        # value across ×24 (...)". It is off in every published version, but the
        # classifier runs on every edge of every response — an unclassified
        # string here is a 500 on a wallet's own evidence page, not a warning.
        if reason.startswith("one ") and " value across ×" in reason:
            return _annotation("single-axis-gas")
    raise ValueError(f"unclassified evidence rule: family={family!r}, reason={reason!r}")


def _annotation(rule_id: str) -> dict[str, str]:
    return {"rule_id": rule_id, "rule_label": EVIDENCE_RULE_LABELS[rule_id]}
