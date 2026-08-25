import { describe, expect, it } from "vitest";

import type { DeltaPayload } from "./domain";
import { countDeltaClasses, validateDelta } from "./delta";

describe("delta model", () => {
  it("counts the classes used to colour map nodes", () => {
    expect(countDeltaClasses(["improved", "worsened", "unchanged", "unchanged"])).toEqual({
      improved: 1,
      worsened: 1,
      under_review: 0,
      unchanged: 2,
    });
  });

  it("rejects a summary that disagrees with the per-wallet classes", () => {
    const payload = {
      counts: { improved: 1, worsened: 0, under_review: 0, unchanged: 0 },
      wallet_classes: ["unchanged"],
    } as unknown as DeltaPayload;

    expect(() => validateDelta(payload)).toThrow("Delta count mismatch for improved");
  });
});
