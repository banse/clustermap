import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WalletDetail } from "../models/domain";
import { WalletProfilePage } from "./WalletProfilePage";

const address = "0x0758a9ff05aba43572334cbdc4c5df03292d424e";

const detail: WalletDetail = {
  version: "2026-08-25-sybilkit-0.2.0",
  wallet: {
    rank: 11_004,
    address,
    points: 651,
    credit_eth: 0.25,
    tx_count: 3,
    name: null,
    weight_eth: 0.3,
    first_hour: 7,
    first_index: 6_025,
  },
  status: "linked",
  analysis_status: "review",
  member_families: ["amount"],
  member_risk: "review",
  cluster: {
    id: 27,
    size: 120,
    confidence: 0.85,
    band: "high",
    points: 10_000,
    points_share: 0.01,
    span_blocks: 20,
    families: ["amount", "cadence", "funding"],
    reasons: [{ family: "amount", text: "Repeated deposit ladder", strength: 0.85 }],
    edge_count: 20,
    risk: "elevated",
    review_flag: false,
    review_reasons: [],
  },
  related_edges: [{
    source: address,
    target: "0x1111111111111111111111111111111111111111",
    family: "amount",
    strength: 0.85,
    reason: "Both wallets used the same uncommon deposit ladder.",
    is_transfer: false,
  }],
  history: [],
  first_funder: null,
  explorer_url: `https://etherscan.io/address/${address}`,
  eth_usd: null,
};

function renderProfile(wallet: WalletDetail) {
  return render(
    <WalletProfilePage
      address={wallet.wallet.address}
      detail={wallet}
      status="listed"
      draft={wallet.wallet.address}
      draftError={null}
      snapshotBlock={25_807_057}
      disclaimer="Evidence links are not ownership proof."
      onDraftChange={vi.fn()}
      onSave={vi.fn()}
      onClear={vi.fn()}
      onShowOnMap={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("WalletProfilePage review evidence", () => {
  it("shows the visual and textual evidence dossier for a wallet under review", () => {
    renderProfile(detail);

    expect(screen.getByRole("heading", { name: "UNDER REVIEW EVIDENCE" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DIRECT EVIDENCE MAP" })).toBeInTheDocument();
    expect(screen.getByText("Both wallets used the same uncommon deposit ladder.")).toBeInTheDocument();
    expect(screen.getByText("85.00% BEHAVIOURAL MATCH")).toBeInTheDocument();
    expect(screen.getByText(/do not prove that the wallets share an owner/)).toBeInTheDocument();
  });

  it("does not show the review dossier for a flagged wallet", () => {
    renderProfile({ ...detail, analysis_status: "flagged", member_risk: "elevated" });

    expect(screen.queryByRole("heading", { name: "UNDER REVIEW EVIDENCE" })).not.toBeInTheDocument();
  });
});
