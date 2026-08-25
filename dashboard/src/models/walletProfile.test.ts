import { describe, expect, it } from "vitest";

import { normalizeEthereumAddress, shortWalletAddress } from "./walletProfile";

describe("wallet profile model", () => {
  it("normalizes valid Ethereum addresses", () => {
    expect(normalizeEthereumAddress("  0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD  ")).toBe(
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    );
  });

  it("rejects malformed addresses", () => {
    expect(normalizeEthereumAddress("vitalik.eth")).toBeNull();
    expect(normalizeEthereumAddress("0x1234")).toBeNull();
    expect(normalizeEthereumAddress("0xgggggggggggggggggggggggggggggggggggggggg")).toBeNull();
  });

  it("creates a compact display label", () => {
    expect(shortWalletAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")).toBe("0xabcd…abcd");
  });
});
