import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewPayload, WalletDetail } from "../models/domain";
import { ReviewPage } from "./ReviewPage";

function wallets(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    address: `0x${String(index).padStart(40, "0")}`,
    name: null,
    points: 1_000 - index,
    rank: index + 1,
    member_families: ["amount"] as const,
  }));
}

const payload: ReviewPayload = {
  version: "2026-08-25-sybilkit-0.2.0",
  totals: {
    review_wallets: 324,
    groups_with_review: 26,
    groups_total: 160,
    population: 19_522,
  },
  groups: [
    {
      id: 27,
      size: 120,
      review_count: 88,
      review_share: 88 / 120,
      risk: "elevated",
      confidence: 0.85,
      families: ["amount", "cadence", "funding"],
      points_share: 0.01,
      wallets: wallets(88),
    },
    {
      id: 15,
      size: 1_002,
      review_count: 1,
      review_share: 1 / 1_002,
      risk: "critical",
      confidence: 0.97,
      families: ["amount", "funding"],
      points_share: 0.05,
      wallets: wallets(1),
    },
  ],
};

const selectedDetail: WalletDetail = {
  version: payload.version,
  wallet: {
    rank: 1,
    address: wallets(1)[0].address,
    points: 1_000,
    credit_eth: 1,
    tx_count: 2,
    name: null,
    weight_eth: 1.2,
    first_hour: 4,
    first_index: 22,
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
    reasons: [{ family: "amount", text: "Repeated deposit amount", strength: 0.84 }],
    edge_count: 20,
    risk: "elevated",
    review_flag: false,
    review_reasons: [],
  },
  related_edges: [{
    source: wallets(1)[0].address,
    target: "0x1111111111111111111111111111111111111111",
    family: "amount",
    strength: 0.84,
    reason: "Both wallets used the same uncommon deposit amount.",
    is_transfer: false,
  }],
  history: [],
  first_funder: null,
  explorer_url: `https://etherscan.io/address/${wallets(1)[0].address}`,
  eth_usd: 3_000,
};

function reviewPage(overrides: Partial<ComponentProps<typeof ReviewPage>> = {}) {
  return (
    <ReviewPage
      review={payload}
      loading={false}
      walletDetail={null}
      walletLoading={false}
      onSelectWallet={() => undefined}
      {...overrides}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("ReviewPage", () => {
  it("leads with the share of a group under review, not its member count", () => {
    render(reviewPage());

    expect(screen.getByRole("heading", { name: "UNDER REVIEW" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GROUP 028" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GROUP 016" })).toBeInTheDocument();
    // 73.33% of a small group ranks above 0.10% of a large one
    expect(screen.getByText("73.33% of the group")).toBeInTheDocument();
    expect(screen.getByText("0.10% of the group")).toBeInTheDocument();
  });

  it("keeps long groups readable until asked to expand", () => {
    render(reviewPage());

    const more = screen.getByRole("button", { name: "Show 76 more" });
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeInTheDocument();
  });

  it("selects review wallets and requests their full evidence", async () => {
    const inspect = vi.fn();
    render(reviewPage({ onSelectWallet: inspect }));

    await waitFor(() => expect(inspect).toHaveBeenCalledWith(wallets(1)[0].address));
    const secondWalletRow = screen.getAllByRole("row").find((row) => row.textContent?.includes("0001"));
    expect(secondWalletRow).toBeDefined();
    fireEvent.click(secondWalletRow!);
    await waitFor(() => expect(inspect).toHaveBeenCalledWith(wallets(2)[1].address));
    expect(secondWalletRow).toHaveAttribute("aria-selected", "true");
  });

  it("explains and visualizes the selected wallet's direct evidence", () => {
    render(reviewPage({ walletDetail: selectedDetail }));

    expect(screen.getByRole("heading", { name: "DIRECT EVIDENCE MAP" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Direct evidence connections/ })).toBeInTheDocument();
    expect(screen.getByText("Both wallets used the same uncommon deposit amount.")).toBeInTheDocument();
    expect(screen.getByText("84.00% BEHAVIOURAL MATCH")).toBeInTheDocument();
    expect(screen.getByText(/do not prove that the wallets share an owner/)).toBeInTheDocument();
  });

  it("says a version has no review tier rather than rendering an empty page", () => {
    render(
      <ReviewPage
        review={{
          version: "2026-08-22-shipped",
          totals: {
            review_wallets: 0,
            groups_with_review: 0,
            groups_total: 263,
            population: 19_522,
          },
          groups: [],
        }}
        loading={false}
        walletDetail={null}
        walletLoading={false}
        onSelectWallet={() => undefined}
      />,
    );

    expect(screen.getByText(/no review tier/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^GROUP/ })).not.toBeInTheDocument();
  });
});
