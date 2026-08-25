export const FOCUS_WALLET_STORAGE_KEY = "clustermap.focus-wallet";

export type WalletProfileStatus = "unset" | "loading" | "listed" | "not-listed" | "error";

const ETHEREUM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function normalizeEthereumAddress(value: string): string | null {
  const trimmed = value.trim();
  return ETHEREUM_ADDRESS.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function shortWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
