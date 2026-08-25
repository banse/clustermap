import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClusterMapController } from "../controllers/useClusterMapController";
import type { ClusterDetail, GlobalMap, Overview, WalletDetail } from "../models/domain";
import { App } from "./App";

vi.mock("./EvidenceGraph", () => ({
  EvidenceGraph: ({ focusedAddress }: { focusedAddress: string | null }) => <div data-testid="evidence-graph" data-focused={focusedAddress ?? ""}>graph</div>,
}));

vi.mock("./ClusterAtlas", () => ({
  ClusterAtlas: ({ focusedClusterId }: { focusedClusterId: number | null }) => <div data-testid="cluster-atlas" data-focused-cluster={focusedClusterId ?? ""}>cluster atlas</div>,
}));

vi.mock("./GlobalWalletMap", () => ({
  GlobalWalletMap: ({ focusedAddress }: { focusedAddress: string | null }) => <div data-testid="global-wallet-map" data-focused={focusedAddress ?? ""}>global map</div>,
}));

afterEach(() => {
  cleanup();
  if (typeof window.localStorage?.clear === "function") window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

const overview: Overview = {
  provenance: {
    chain_id: 1,
    chain_name: "Ethereum",
    contract: "0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91",
    deployment_block: 25_769_870,
    snapshot_block: 25_807_057,
    snapshot_at: "2026-08-22T00:00:00Z",
    sybilkit_version: "0.1.1",
    sybilkit_revision: "61696545dd93f52daedd87e37a648e10fdfc8da5",
  },
  totals: {
    population: 19_522,
    deposits: 28_353,
    groups: 263,
    linked_wallets: 11_573,
    unlinked_wallets: 7_949,
    points: 29_675_956,
    linked_points: 17_103_032,
    tx_fingerprints: 12_203,
    funding_rows: 12_498,
  },
  analysis: {
    min_size: 5,
    min_families: 2,
    points_per_eth: 1_000,
    min_deposit_wei: 50_000_000_000_000_000,
    eth_usd: null,
    disclaimer: "Evidence links are not ownership proof.",
  },
  clusters: [
    {
      id: 0,
      size: 1_104,
      confidence: 0.99,
      band: "high",
      points: 5_247_839,
      points_share: 0.1768,
      span_blocks: 100,
      families: ["amount", "cadence", "funding"],
      reasons: [{ family: "funding", text: "Shared first funder", strength: 0.95 }],
      edge_count: 2_782,
      risk: "critical",
      review_flag: false,
      review_reasons: [],
    },
  ],
};

const globalMap: GlobalMap = {
  nodes: [],
  edges: [],
  meta: {
    node_count: 19_522,
    edge_count: 11_310,
    risk_counts: { independent: 7_949, review: 80, elevated: 3_000, critical: 8_493 },
    review_cluster_count: 56,
    layout: "test",
  },
};

const wallet: WalletDetail = {
  wallet: {
    rank: 24,
    address: "0xd15031d0942634ccac10274e68945a23d2720922",
    points: 13_940,
    credit_eth: 171.99,
    tx_count: 2,
    name: null,
    weight_eth: 200,
    first_hour: 20,
    first_index: 14_450,
  },
  status: "linked",
  cluster: overview.clusters[0],
  related_edges: [],
  first_funder: null,
  explorer_url: "https://etherscan.io/address/0xd15031d0942634ccac10274e68945a23d2720922",
  eth_usd: null,
};

const clusterDetail: ClusterDetail = {
  cluster: overview.clusters[0],
  nodes: [],
  edges: [],
};

function controller(
  selectedWallet: WalletDetail | null = null,
  selectedCluster: ClusterDetail | null = null,
  focusedWallet: WalletDetail | null = null,
  focusedAddress: string | null = focusedWallet?.wallet.address ?? null,
): ClusterMapController {
  return {
    overview,
    cluster: selectedCluster,
    globalMap,
    wallet: selectedWallet,
    focusedWalletAddress: focusedAddress,
    focusedWallet,
    focusedWalletStatus: focusedWallet === null ? (focusedAddress === null ? "unset" : "not-listed") : "listed",
    list: { rows: [], total: 0, offset: 0, limit: 50 },
    filters: { query: "", link: "all", evidence: "all", preset: "none", offset: 0, limit: 50 },
    loading: { overview: false, globalMap: false, cluster: false, wallet: false, list: false },
    error: null,
    resetViewKey: 0,
    openCluster: vi.fn(async () => undefined),
    inspectWallet: vi.fn(async () => true),
    setFocusedWallet: vi.fn(() => true),
    clearFocusedWallet: vi.fn(),
    backToOverview: vi.fn(),
    closeWallet: vi.fn(),
    setQuery: vi.fn(),
    setLinkFilter: vi.fn(),
    setEvidenceFilter: vi.fn(),
    setPreset: vi.fn(),
    setListView: vi.fn(),
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    refresh: vi.fn(),
    exportList: vi.fn(async () => "the-list.json"),
    resetView: vi.fn(),
    clearError: vi.fn(),
  };
}

describe("App", () => {
  it("opens on a source-grounded welcome page with a tentative NFT outlook", () => {
    render(<App controller={controller()} />);

    expect(screen.getByRole("heading", { name: "WhitelistCurator.sol" })).toBeInTheDocument();
    expect(screen.getByText("THE LIST · SYBILKIT · CLUSTERMAP")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What this map shows" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /PRESENCE WAS.*THE PRODUCT/ })).toBeInTheDocument();
    const excerpts = screen.getByRole("region", { name: "WhitelistCurator contract excerpts" });
    expect(excerpts).toHaveTextContent("@title WhitelistCurator");
    expect(excerpts).toHaveTextContent("FOR BUILDERS CONSUMING THIS LIST");
    expect(excerpts).toHaveTextContent("Nobody can retroactively have been here");
    const contractComments = excerpts.querySelectorAll(".contract-comment");
    expect(contractComments[0]).toHaveAttribute("aria-label", "WhitelistCurator title and notice");
    expect(contractComments[1]).toHaveAttribute("aria-label", "WhitelistCurator builder guidance");
    expect(screen.queryByRole("heading", { name: /I WAS HERE|I COUNT/ })).not.toBeInTheDocument();
    expect(screen.getByText(/SybilKit was built for that gap/)).toBeInTheDocument();
    expect(screen.getByText(/No collection, mint, snapshot, or eligibility rule is announced here/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Current analysis ledger" })).toHaveTextContent("19,522");
    expect(screen.getByRole("link", { name: /MAXPANE/ })).toHaveAttribute("href", "https://github.com/banse/maxpane");
    expect(screen.getByRole("link", { name: /SYBILKIT/ })).toHaveAttribute("href", "https://pypi.org/project/sybilkit/");
    expect(screen.getByRole("link", { name: /WHITELISTCURATOR\.SOL/ })).toHaveAttribute("href", "https://etherscan.io/address/0xcb0b0531e86a9ac36fa865ca8e3dbccf047fda91#code");
    expect(screen.getByText(/2026 hisdudeness\.eth/)).toHaveTextContent("☮ 2026 hisdudeness.eth – The Dude Abides.");
    expect(screen.queryByTestId("cluster-atlas")).not.toBeInTheDocument();
  });

  it("opens the cluster atlas from the welcome page and keeps MaxPane views hidden", () => {
    render(<App controller={controller()} />);

    fireEvent.click(screen.getByRole("button", { name: "OPEN THE MAP" }));
    expect(screen.getAllByRole("heading", { name: "Evidence atlas" })).not.toHaveLength(0);
    expect(screen.getByTestId("cluster-atlas")).toBeInTheDocument();
    expect(screen.queryByTestId("global-wallet-map")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "MaxPane views" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "WELCOME" }));
    expect(screen.getByRole("heading", { name: /PRESENCE WAS.*THE PRODUCT/ })).toBeInTheDocument();
  });

  it("switches to the wallet field and back to the default cluster atlas", () => {
    const data = controller();
    render(<App controller={data} />);

    fireEvent.click(screen.getByRole("button", { name: "MAP" }));
    fireEvent.click(screen.getByRole("button", { name: "WALLETS" }));
    expect(screen.getByTestId("global-wallet-map")).toBeInTheDocument();
    expect(data.closeWallet).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "CLUSTERS" }));
    expect(screen.getByTestId("cluster-atlas")).toBeInTheDocument();
  });

  it("ships MaxPane as the only available theme while the switcher is dormant", () => {
    render(<App controller={controller()} />);

    expect(document.documentElement.dataset.theme).toBe("maxpane");
    expect(screen.queryByRole("group", { name: "Choose color theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Light" })).not.toBeInTheDocument();
  });

  it("explains THE LIST origin, SybilKit threshold and evidence limits", () => {
    render(<App controller={controller()} />);

    fireEvent.click(screen.getByRole("button", { name: "MAP" }));
    expect(screen.getByRole("region", { name: "What this map shows" })).toHaveTextContent("zero-custody Ethereum allowlist game");
    expect(screen.getByText(/Groups require 5\+ wallets and 2\+ independent evidence families/)).toBeInTheDocument();
    expect(screen.getByText(/they do not prove common ownership/)).toBeInTheDocument();
  });

  it("shows complete wallet details inline without a popup or dialog", () => {
    const data = controller(wallet);
    render(<App controller={data} />);

    fireEvent.click(screen.getByRole("button", { name: "MAP" }));
    expect(screen.getByRole("heading", { name: "RANK #24" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "WALLET FACTS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "RELATED EVIDENCE" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close wallet details" }));
    expect(data.closeWallet).toHaveBeenCalled();
    expect(screen.getByTestId("cluster-atlas")).toBeInTheDocument();
  });

  it("shows why a selected group exists below its map", async () => {
    render(<App controller={controller(null, clusterDetail)} />);

    fireEvent.click(screen.getByRole("button", { name: "MAP" }));
    fireEvent.click(screen.getByRole("button", { name: /GROUP 001.*1,104 wallets/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "WHY THIS GROUP EXISTS" })).toBeInTheDocument());
    expect(screen.getByText("Shared first funder")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-graph")).toBeInTheDocument();
  });

  it("validates and saves a typed wallet without connecting", () => {
    const data = controller();
    render(<App controller={data} />);

    fireEvent.click(screen.getByRole("button", { name: "SET WALLET" }));
    expect(screen.getByRole("heading", { name: "YOUR WALLET PROFILE" })).toBeInTheDocument();
    expect(screen.getByText(/persistent YOU reticle/)).toBeInTheDocument();
    expect(screen.getByText(/no wallet permission or signature is requested/i)).toBeInTheDocument();

    const input = screen.getByLabelText("ETHEREUM ADDRESS");
    fireEvent.change(input, { target: { value: "not-a-wallet" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("42-character Ethereum address");

    fireEvent.change(input, { target: { value: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD" } });
    fireEvent.submit(input.closest("form")!);
    expect(data.setFocusedWallet).toHaveBeenCalledWith("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  });

  it("shows list and clustering data on the saved wallet profile", async () => {
    const data = controller(null, null, wallet);
    render(<App controller={data} />);

    fireEvent.click(screen.getByRole("button", { name: /PROFILE/ }));
    expect(screen.getByText("IN THE LIST · RANK #24")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ORIGINAL ALLOWLIST RECORD" })).toBeInTheDocument();
    // A wallet page states MEMBERSHIP of a group, not a verdict about the
    // wallet: the tier is a property of the cluster, and a member may be held
    // there by a single rule. See `audit/`.
    expect(screen.getByText("IN A STRONG-EVIDENCE GROUP")).toBeInTheDocument();
    expect(screen.getByText(/GROUP 001 · 99.00% confidence/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "SHOW ON MAP" }));
    await waitFor(() => expect(data.inspectWallet).toHaveBeenCalledWith(wallet.wallet.address, 0));
  });

  it("marks the saved wallet or its group in each applicable graph", async () => {
    const data = controller(null, null, wallet);
    const { rerender } = render(<App controller={data} />);

    fireEvent.click(screen.getByRole("button", { name: "MAP" }));
    expect(screen.getByTestId("cluster-atlas")).toHaveAttribute("data-focused-cluster", "0");
    fireEvent.click(screen.getByRole("button", { name: "WALLETS" }));
    expect(screen.getByTestId("global-wallet-map")).toHaveAttribute("data-focused", wallet.wallet.address);

    rerender(<App controller={controller(null, clusterDetail, wallet)} />);
    fireEvent.click(screen.getByRole("button", { name: /GROUP 001.*1,104 wallets/ }));
    await waitFor(() => expect(screen.getByTestId("evidence-graph")).toHaveAttribute("data-focused", wallet.wallet.address));
  });

  it("explains a valid wallet outside the frozen list", () => {
    const address = "0x0000000000000000000000000000000000000000";
    render(<App controller={controller(null, null, null, address)} />);

    fireEvent.click(screen.getByRole("button", { name: /PROFILE/ }));
    expect(screen.getByRole("heading", { name: "NOT IN THE ORIGINAL LIST" })).toBeInTheDocument();
    expect(screen.getByText(/has no wallet node, rank, points, or SybilKit group/)).toBeInTheDocument();
  });
});
