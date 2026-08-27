import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ReviewPayload } from "../models/domain";
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

afterEach(() => {
  cleanup();
});

describe("ReviewPage", () => {
  it("leads with the share of a group under review, not its member count", () => {
    render(<ReviewPage review={payload} loading={false} />);

    expect(screen.getByRole("heading", { name: "UNDER REVIEW" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GROUP 028" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GROUP 016" })).toBeInTheDocument();
    // 73.33% of a small group ranks above 0.10% of a large one
    expect(screen.getByText("73.33% of the group")).toBeInTheDocument();
    expect(screen.getByText("0.10% of the group")).toBeInTheDocument();
  });

  it("keeps long groups readable until asked to expand", () => {
    render(<ReviewPage review={payload} loading={false} />);

    const more = screen.getByRole("button", { name: "Show 76 more" });
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeInTheDocument();
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
      />,
    );

    expect(screen.getByText(/no review tier/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^GROUP/ })).not.toBeInTheDocument();
  });
});
