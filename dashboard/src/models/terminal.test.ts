import { describe, expect, it } from "vitest";

import { nextHistoryView, nextListView } from "./terminal";

describe("terminal state model", () => {
  it("cycles MaxPane list views", () => {
    expect(nextListView("raw")).toBe("clean");
    expect(nextListView("clean")).toBe("filtered");
    expect(nextListView("filtered")).toBe("raw");
  });

  it("toggles history views", () => {
    expect(nextHistoryView("map")).toBe("signals");
    expect(nextHistoryView("signals")).toBe("map");
  });
});
