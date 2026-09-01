import { describe, expect, it } from "vitest";

import type { EvidenceEdge } from "./domain";
import { projectWalletEvidence } from "./walletEvidence";

const selected = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const walletB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const walletC = "0xcccccccccccccccccccccccccccccccccccccccc";

const edges: readonly EvidenceEdge[] = [
  {
    source: selected,
    target: walletB,
    family: "funding",
    strength: 0.95,
    reason: "tight funding transfer",
    is_transfer: true,
    rule_id: "tight-peel-chain",
    rule_label: "Tight peel chain",
  },
  {
    source: selected,
    target: walletB,
    family: "cadence",
    strength: 0.8,
    reason: "deposit follows funder within 30 blocks",
    is_transfer: false,
    rule_id: "tight-peel-chain",
    rule_label: "Tight peel chain",
  },
  {
    source: walletC,
    target: selected.toUpperCase(),
    family: "amount",
    strength: 0.7,
    reason: "near-identical in one block",
    is_transfer: false,
    rule_id: "near-same-block",
    rule_label: "Near-identical same-block amount",
  },
];

describe("projectWalletEvidence", () => {
  it("centres the selected wallet and preserves every published incident edge", () => {
    const projection = projectWalletEvidence(selected, edges, null);

    expect(projection.center.address).toBe(selected);
    expect(projection.availableRules.map((rule) => rule.ruleId)).toEqual([
      "near-same-block",
      "tight-peel-chain",
    ]);
    expect(projection.rules).toHaveLength(2);
    expect(projection.counterparts.map((wallet) => wallet.address)).toEqual([walletB, walletC]);
    expect(projection.incidents).toHaveLength(3);
    expect(projection.directNeighborCount).toBe(2);
    expect(projection.displayedLinkCount).toBe(3);
  });

  it("reduces the graph to one rule while keeping the all-state selectors stable", () => {
    const focused = projectWalletEvidence(selected, edges, "tight-peel-chain");

    expect(focused.selectedRuleId).toBe("tight-peel-chain");
    expect(focused.availableRules).toHaveLength(2);
    expect(focused.rules.map((rule) => rule.ruleId)).toEqual(["tight-peel-chain"]);
    expect(focused.counterparts.map((wallet) => wallet.address)).toEqual([walletB]);
    expect(focused.incidents).toHaveLength(2);
    expect(focused.displayedLinkCount).toBe(2);

    const invalid = projectWalletEvidence(selected, edges, "not-published");
    expect(invalid.selectedRuleId).toBeNull();
    expect(invalid.incidents).toHaveLength(3);
  });

  it("keeps paired families distinct and derives transfer semantics from the family", () => {
    const projection = projectWalletEvidence(selected, edges, "tight-peel-chain");
    const [cadence, funding] = projection.incidents;

    expect(cadence.family).toBe("cadence");
    expect(cadence.kind).toBe("behavior");
    expect(funding.family).toBe("funding");
    expect(funding.kind).toBe("transfer");
    expect(cadence.parallelOffset).not.toBe(funding.parallelOffset);
    expect(new Set(projection.incidents.map((incident) => incident.id)).size).toBe(2);
  });

  it("shows only the centre wallet when no direct rule applies", () => {
    const projection = projectWalletEvidence(selected, [], "tight-peel-chain");

    expect(projection.isIsolated).toBe(true);
    expect(projection.selectedRuleId).toBeNull();
    expect(projection.availableRules).toEqual([]);
    expect(projection.rules).toEqual([]);
    expect(projection.counterparts).toEqual([]);
    expect(projection.incidents).toEqual([]);
  });
});
