import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, ClusterMapApi } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("ClusterMapApi", () => {
  it("encodes list filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rows: [], total: 0, offset: 50, limit: 50 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = new ClusterMapApi("/test");

    await api.list({ query: "0xabc", link: "linked", evidence: "high", preset: "whale", offset: 50, limit: 50 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/test/list?q=0xabc&link=linked&evidence=high&preset=whale&offset=50&limit=50",
      { signal: undefined },
    );
  });

  it("surfaces the API detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "cluster not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(new ClusterMapApi("/test").cluster(999)).rejects.toEqual(
      new ApiError("cluster not found", 404),
    );
  });

  it("loads the global wallet map", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nodes: [], edges: [], meta: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await new ClusterMapApi("/test").globalMap();

    expect(fetchMock).toHaveBeenCalledWith("/test/map/global", { signal: undefined });
  });
});
