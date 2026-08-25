import { describe, expect, it } from "vitest";

import {
  bandLabel,
  clusterLabel,
  familyLabel,
  formatEth,
  formatPercent,
} from "./presentation";

describe("presentation", () => {
  it("keeps evidence language descriptive", () => {
    expect(bandLabel("high")).toBe("Multi-family evidence");
    expect(bandLabel("low")).toBe("Two-family evidence");
    expect(bandLabel("none")).toBe("No group link");
    expect(familyLabel("funding")).toBe("Funding transfer");
  });

  it("formats group identity and financial context", () => {
    expect(clusterLabel(0)).toBe("GROUP 001");
    expect(formatPercent(0.176838)).toBe("17.68%");
    expect(formatEth(2, 4_000)).toContain("≈ $8,000");
    expect(formatEth(2, null)).toContain("USD unavailable");
  });
});

