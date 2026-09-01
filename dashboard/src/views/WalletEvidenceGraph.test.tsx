import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvidenceEdge } from "../models/domain";
import { WalletEvidenceGraph } from "./WalletEvidenceGraph";

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
    source: selected,
    target: walletC,
    family: "sequence",
    strength: 0.9,
    reason: "consecutive join indices",
    is_transfer: false,
    rule_id: "consecutive-joins",
    rule_label: "Consecutive joins",
  },
];

afterEach(cleanup);

describe("WalletEvidenceGraph", () => {
  it("renders all direct rules, neighbours and published links by default", () => {
    render(
      <WalletEvidenceGraph
        address={selected}
        edges={edges}
        selectedRuleId={null}
        onSelectRule={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "WALLET EVIDENCE" })).toBeInTheDocument();
    expect(screen.getByText("2 DIRECT WALLETS")).toBeInTheDocument();
    expect(screen.getByText("2 RULES")).toBeInTheDocument();
    expect(screen.getByText("3 DISPLAYED LINKS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ALL TRIGGERED RULES" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Consecutive joins" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Tight peel chain" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByTestId("wallet-evidence-incident")).toHaveLength(3);
    expect(screen.getByText("MEASURED TRANSFER")).toBeInTheDocument();
    expect(screen.getByText("BEHAVIOURAL MATCH")).toBeInTheDocument();
  });

  it("asks the controller to focus or clear one keyboard-accessible rule", async () => {
    const user = userEvent.setup();
    const onSelectRule = vi.fn();
    const { rerender } = render(
      <WalletEvidenceGraph
        address={selected}
        edges={edges}
        selectedRuleId={null}
        onSelectRule={onSelectRule}
      />,
    );

    const rule = screen.getByRole("button", { name: "Tight peel chain" });
    rule.focus();
    await user.keyboard("{Enter}");
    expect(onSelectRule).toHaveBeenLastCalledWith("tight-peel-chain");

    rerender(
      <WalletEvidenceGraph
        address={selected}
        edges={edges}
        selectedRuleId="tight-peel-chain"
        onSelectRule={onSelectRule}
      />,
    );
    expect(screen.getAllByTestId("wallet-evidence-incident")).toHaveLength(2);
    expect(screen.getByText("1 DIRECT WALLET")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tight peel chain" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tight peel chain" }));
    expect(onSelectRule).toHaveBeenLastCalledWith(null);
  });

  it("renders paired outputs as distinct transfer and behavior paths", () => {
    render(
      <WalletEvidenceGraph
        address={selected}
        edges={edges}
        selectedRuleId="tight-peel-chain"
        onSelectRule={vi.fn()}
      />,
    );

    const paths = screen.getAllByTestId("wallet-evidence-incident");
    expect(paths[0]).toHaveAttribute("data-kind", "behavior");
    expect(paths[1]).toHaveAttribute("data-kind", "transfer");
    expect(paths[0].getAttribute("d")).not.toBe(paths[1].getAttribute("d"));
  });

  it("keeps an isolated wallet visible with an explicit no-rule state", () => {
    render(
      <WalletEvidenceGraph
        address={selected}
        edges={[]}
        selectedRuleId="tight-peel-chain"
        onSelectRule={vi.fn()}
      />,
    );

    expect(screen.getByText("NO DIRECT RULE ON THIS WALLET")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-evidence-selected-wallet")).toBeInTheDocument();
    expect(screen.queryAllByTestId("wallet-evidence-incident")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "ALL TRIGGERED RULES" })).toBeDisabled();
  });
});
