import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisVersion, ListFilters, ListPage, Overview } from "../models/domain";
import { ListLeaderboardPage } from "./ListLeaderboardPage";

afterEach(cleanup);

const version: AnalysisVersion = {
  id: "2026-08-25-sybilkit-0.2.0",
  label: "SybilKit 0.2.0",
  at: "2026-08-25T00:00:00Z",
  stage: "published",
  summary: "Published analysis.",
  detector: "sybilkit",
  detector_version: "0.2.0",
  rule_set: "v2h",
  snapshot_block: 25_807_057,
  commit: "abc1234",
  tag: "v0.2.0",
  reproduce_command: "make versions",
  content_hash: "hash",
  published: true,
  list_scope: "retained",
  status_counts: { clean: 6_782, review: 324, flagged: 12_416 },
  cluster_count: 160,
};

const overview: Overview = {
  version,
  provenance: {
    chain_id: 1,
    chain_name: "Ethereum",
    contract: "0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91",
    deployment_block: 25_769_870,
    snapshot_block: 25_807_057,
    snapshot_at: "2026-08-22T00:00:00Z",
    sybilkit_version: "0.1.1",
    sybilkit_revision: "revision",
  },
  totals: {
    population: 19_522,
    deposits: 28_353,
    groups: 160,
    linked_wallets: 12_740,
    unlinked_wallets: 6_782,
    points: 29_675_956,
    linked_points: 17_103_032,
    tx_fingerprints: 12_203,
    funding_rows: 12_498,
    status_counts: version.status_counts,
  },
  analysis: {
    min_size: 5,
    min_families: 2,
    points_per_eth: 1_000,
    min_deposit_wei: 50_000_000_000_000_000,
    eth_usd: null,
    disclaimer: "Evidence is not ownership proof.",
  },
  clusters: [],
};

const retainedVersion: AnalysisVersion = {
  ...version,
  id: "2026-08-22-shipped",
  label: "Original SybilKit 0.1.1",
  stage: "superseded",
  detector_version: "0.1.1",
  rule_set: "shipped",
  published: false,
  status_counts: { clean: 7_949, review: 0, flagged: 11_573 },
  cluster_count: 263,
};

const rawVersion: AnalysisVersion = {
  ...version,
  id: "2026-08-22-whitelistcurator-raw",
  label: "Original WhitelistCurator.sol list",
  stage: "source",
  detector: "whitelistcurator",
  detector_version: "raw",
  rule_set: "none (raw contract list)",
  published: false,
  list_scope: "raw",
  status_counts: { clean: 19_522, review: 0, flagged: 0 },
  cluster_count: 0,
};

const page: ListPage = {
  version: version.id,
  total: 7_106,
  offset: 0,
  limit: 50,
  rows: [
    {
      version: version.id,
      filter_rank: 1,
      rank: 11_004,
      retained_rank: 2_605,
      clean_rank: null,
      address: "0x0758a9ff05aba43572334cbdc4c5df03292d424e",
      points: 651,
      credit_eth: 0.25,
      tx_count: 3,
      name: "wallet.eth",
      weight_eth: 0.42,
      first_hour: 7,
      first_index: 6_025,
      cluster_id: 42,
      evidence_band: "low",
      status: "review",
      risk: "review",
      member_families: ["amount"],
      member_family_count: 1,
      under_review: true,
      deposit_count: 3,
      deposit_total_eth: 0.45,
      min_deposit_eth: 0.05,
      max_deposit_eth: 0.25,
      last_hour: 8,
    },
    {
      version: version.id,
      filter_rank: 2,
      rank: 24,
      retained_rank: 19,
      clean_rank: 18,
      address: "0xd15031d0942634ccac10274e68945a23d2720922",
      points: 13_940,
      credit_eth: 171.99,
      tx_count: 2,
      name: null,
      weight_eth: 200,
      first_hour: 20,
      first_index: 14_450,
      cluster_id: null,
      evidence_band: "none",
      status: "clean",
      risk: "independent",
      member_families: [],
      member_family_count: 0,
      under_review: false,
      deposit_count: 2,
      deposit_total_eth: 172.04,
      min_deposit_eth: 0.05,
      max_deposit_eth: 171.99,
      last_hour: 20,
    },
  ],
};

const filters: ListFilters = {
  query: "",
  link: "selected",
  evidence: "all",
  preset: "none",
  sort: "rank",
  direction: "asc",
  offset: 0,
  limit: 50,
};

function renderPage(
  activeFilters: ListFilters = filters,
  activePage: ListPage = page,
  activeVersion: AnalysisVersion = version,
  activeOverview: Overview = overview,
) {
  const actions = {
    onQuery: vi.fn(),
    onPreset: vi.fn(),
    onSort: vi.fn(),
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    onExport: vi.fn(),
    onOpenWallet: vi.fn(),
  };
  render(
    <ListLeaderboardPage
      page={activePage}
      filters={activeFilters}
      overview={activeOverview}
      version={activeVersion}
      loading={false}
      {...actions}
    />,
  );
  return actions;
}

describe("ListLeaderboardPage", () => {
  it("renders clean-wallet attributes with gapless and original positions", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "THE LIST (RETAINED + UNDER REVIEW)" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Wallet leaderboard for SybilKit 0.2.0/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Clean / original rank" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("ORIGINAL #11,004")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("ORIGINAL #24")).toBeInTheDocument();
    expect(screen.getByText("wallet.eth")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Standing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Group" })).not.toBeInTheDocument();
    expect(screen.queryByText("Flagged by this rule set")).not.toBeInTheDocument();
    expect(screen.getByText("0.25 ETH")).toBeInTheDocument();
    expect(screen.getByText("0.42 ETH")).toBeInTheDocument();
    expect(screen.queryByText(/USD unavailable/)).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Deposits" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Deposit range" })).toBeInTheDocument();
    expect(screen.getByText("HOURS 7–8")).toBeInTheDocument();
    expect(screen.getByText("ENTRY INDEX #6,025")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CLEAN LIST" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ENS NAME SET" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "FIRST 1,000 ENTRIES" })).not.toBeInTheDocument();
    const summary = screen.getByText("CLEAN / FILTERED").closest("div");
    expect(summary).toHaveTextContent("7,106 wallets");
  });

  it("labels selected-list presets as a filter with their own rank", () => {
    renderPage(
      { ...filters, preset: "hour0" },
      { ...page, total: 87 },
    );

    expect(screen.getByRole("columnheader", { name: "Filter / original rank" })).toBeInTheDocument();
    expect(screen.getAllByText("HOUR ZERO")).toHaveLength(2);
    expect(screen.getByText("#1")).toBeInTheDocument();
    const summary = screen.getByText("CLEAN / FILTERED").closest("div");
    expect(summary).toHaveTextContent("87 wallets");
  });

  it("shows the raw contract population and its raw-only first-1000 preset", () => {
    const rawOverview: Overview = {
      ...overview,
      version: rawVersion,
      totals: {
        ...overview.totals,
        groups: 0,
        linked_wallets: 0,
        unlinked_wallets: 19_522,
        linked_points: 0,
        status_counts: rawVersion.status_counts,
      },
    };
    renderPage(
      filters,
      { ...page, version: rawVersion.id, total: 19_522 },
      rawVersion,
      rawOverview,
    );

    expect(screen.getByRole("heading", { name: "THE LIST (RAW)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "RAW LIST" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "FIRST 1,000 ENTRIES" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ENS NAME SET" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Raw / original rank" })).toBeInTheDocument();
    expect(screen.getByText("RAW / FILTERED").closest("div")).toHaveTextContent("19,522 wallets");
  });

  it("uses the retained title when the selected SybilKit version has no review tier", () => {
    const retainedOverview: Overview = {
      ...overview,
      version: retainedVersion,
      totals: {
        ...overview.totals,
        groups: 263,
        linked_wallets: 11_573,
        unlinked_wallets: 7_949,
        status_counts: retainedVersion.status_counts,
      },
    };
    renderPage(
      filters,
      { ...page, version: retainedVersion.id, total: 7_949 },
      retainedVersion,
      retainedOverview,
    );

    expect(screen.getByRole("heading", { name: "THE LIST (RETAINED)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CLEAN LIST" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "FIRST 1,000 ENTRIES" })).not.toBeInTheDocument();
  });

  it("keeps the retained-list rank when search narrows the rows", () => {
    renderPage(
      { ...filters, query: "wallet.eth" },
      {
        ...page,
        total: 1,
        rows: [{ ...page.rows[0], filter_rank: 2_504 }],
      },
    );

    expect(screen.getByText("#2,504")).toBeInTheDocument();
    expect(screen.getByText("ORIGINAL #11,004")).toBeInTheDocument();
  });

  it("delegates every data-column sort and exposes the active direction", () => {
    const actions = renderPage({ ...filters, sort: "points", direction: "desc" });
    const columns: ReadonlyArray<readonly [string, ListFilters["sort"]]> = [
      ["Clean / original rank", "rank"],
      ["Wallet", "wallet"],
      ["Points", "points"],
      ["Credit", "credit"],
      ["Weight", "weight"],
      ["Deposits", "deposits"],
      ["Gross deposited", "gross"],
      ["Deposit range", "range"],
      ["Hour window", "window"],
    ];

    expect(screen.getByRole("columnheader", { name: "Points" })).toHaveAttribute("aria-sort", "descending");
    for (const [label] of columns) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sort by ${label}`) }));
    }

    expect(actions.onSort.mock.calls.map(([column]) => column)).toEqual(
      columns.map(([, column]) => column),
    );
  });

  it("delegates filters, paging, export, and profile navigation", () => {
    const actions = renderPage();

    fireEvent.change(screen.getByLabelText("SEARCH ADDRESS OR NAME"), { target: { value: "wallet.eth" } });
    fireEvent.change(screen.getByLabelText("ENTRY PRESET"), { target: { value: "ens" } });
    fireEvent.click(screen.getByRole("button", { name: "EXPORT CURRENT VIEW ↓" }));
    fireEvent.click(screen.getAllByRole("button", { name: "PROFILE" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "NEXT 50 →" }));

    expect(actions.onQuery).toHaveBeenCalledWith("wallet.eth");
    expect(actions.onPreset).toHaveBeenCalledWith("ens");
    expect(actions.onExport).toHaveBeenCalled();
    expect(actions.onOpenWallet).toHaveBeenCalledWith(page.rows[0].address);
    expect(actions.onNextPage).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "← PREVIOUS 50" })).toBeDisabled();
  });
});
