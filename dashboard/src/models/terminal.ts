import type { ListFilters } from "./domain";

export type TerminalMode = "lists" | "history" | "you";
export type ListView = "raw" | "clean" | "filtered";
export type HistoryView = "map" | "signals";

export interface Shortcut {
  readonly key: string;
  readonly label: string;
  readonly action: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { key: "l", label: "lists", action: "Open THE LIST" },
  { key: "h", label: "history", action: "Open SybilKit history" },
  { key: "y", label: "you", action: "Inspect selected wallet" },
  { key: "c", label: "view", action: "Cycle the active view" },
  { key: "f", label: "filter", action: "Open filters" },
  { key: "w", label: "wallet", action: "Choose a wallet" },
  { key: "r", label: "refresh", action: "Reload snapshot data" },
  { key: "e", label: "export", action: "Download current list" },
  { key: "?", label: "keys", action: "Show this keyboard reference" },
];

export const PRESETS: readonly {
  key: "1" | "2" | "3" | "4";
  value: Exclude<ListFilters["preset"], "none">;
  label: string;
  detail: string;
}[] = [
  { key: "1", value: "first1000", label: "First 1000", detail: "join index 1–1000" },
  { key: "2", value: "hour0", label: "Hour 0", detail: "first deposit in hour zero" },
  { key: "3", value: "whale", label: "Whale splash", detail: "single deposit ≥25 ETH" },
  { key: "4", value: "ens", label: "ENS name set", detail: "recorded ENS name present" },
];

export function nextListView(view: ListView): ListView {
  if (view === "raw") return "clean";
  if (view === "clean") return "filtered";
  return "raw";
}

export function nextHistoryView(view: HistoryView): HistoryView {
  return view === "map" ? "signals" : "map";
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']");
}
