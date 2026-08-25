import { useCallback, useEffect, useMemo, useState } from "react";

import type { WalletRow } from "../models/domain";
import {
  isEditableTarget,
  nextHistoryView,
  nextListView,
  PRESETS,
  type HistoryView,
  type ListView,
  type TerminalMode,
} from "../models/terminal";
import type { ClusterMapController } from "./useClusterMapController";

export interface TerminalController {
  readonly mode: TerminalMode;
  readonly listView: ListView;
  readonly historyView: HistoryView;
  readonly cursor: number;
  readonly filterOpen: boolean;
  readonly walletPromptOpen: boolean;
  readonly helpOpen: boolean;
  readonly notice: string;
  readonly navigate: (mode: TerminalMode) => void;
  readonly cycleView: () => void;
  readonly toggleFilters: () => void;
  readonly openWalletPrompt: () => void;
  readonly closeOverlays: () => void;
  readonly toggleHelp: () => void;
  readonly setCursor: (index: number) => void;
  readonly inspect: (row: WalletRow) => Promise<void>;
  readonly submitWallet: (address: string) => Promise<void>;
  readonly applyPreset: (key: "1" | "2" | "3") => void;
}

export function useTerminalController(data: ClusterMapController): TerminalController {
  const [mode, setMode] = useState<TerminalMode>("lists");
  const [listView, setListViewState] = useState<ListView>("raw");
  const [historyView, setHistoryView] = useState<HistoryView>("map");
  const [cursor, setCursor] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState("READY");

  const navigate = useCallback(
    (nextMode: TerminalMode) => {
      if (nextMode === "you" && data.wallet === null) {
        setWalletPromptOpen(true);
        setNotice("ENTER A WALLET FROM THE ORIGINAL LIST");
        return;
      }
      setMode(nextMode);
      setNotice(`VIEW: ${nextMode.toUpperCase()}`);
    },
    [data.wallet],
  );

  const cycleView = useCallback(() => {
    if (mode === "lists") {
      const next = nextListView(listView);
      setListViewState(next);
      data.setListView(next);
      if (next === "filtered") setFilterOpen(true);
      setNotice(`LIST VIEW: ${next.toUpperCase()}`);
      return;
    }
    if (mode === "history") {
      setHistoryView((current) => {
        const next = nextHistoryView(current);
        setNotice(`HISTORY VIEW: ${next.toUpperCase()}`);
        return next;
      });
    }
  }, [data, listView, mode]);

  const inspect = useCallback(
    async (row: WalletRow) => {
      const loaded = await data.inspectWallet(row.address, row.cluster_id);
      if (!loaded) return;
      setMode("you");
      setWalletPromptOpen(false);
      setNotice(`WALLET #${row.rank} LOADED`);
    },
    [data],
  );

  const submitWallet = useCallback(
    async (address: string) => {
      const loaded = await data.inspectWallet(address.trim());
      if (!loaded) return;
      setMode("you");
      setWalletPromptOpen(false);
      setNotice("WALLET LOADED");
    },
    [data],
  );

  const applyPreset = useCallback(
    (key: "1" | "2" | "3") => {
      const preset = PRESETS.find((item) => item.key === key);
      if (preset === undefined) return;
      setMode("lists");
      setListViewState("filtered");
      setFilterOpen(true);
      setCursor(0);
      data.setListView("raw");
      data.setPreset(preset.value);
      setNotice(`PRESET ${key}: ${preset.label.toUpperCase()}`);
    },
    [data],
  );

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, (data.list?.rows.length ?? 1) - 1)));
  }, [data.list]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (helpOpen || walletPromptOpen || filterOpen) {
          setHelpOpen(false);
          setWalletPromptOpen(false);
          setFilterOpen(false);
        } else {
          setMode("lists");
        }
        return;
      }
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (["l", "h", "y", "c", "f", "w", "r", "e", "?", "/", "1", "2", "3", "j", "k", "arrowdown", "arrowup", "enter", "pagedown", "pageup"].includes(key)) {
        event.preventDefault();
      }
      if (key === "l") navigate("lists");
      else if (key === "h") navigate("history");
      else if (key === "y") navigate("you");
      else if (key === "c") cycleView();
      else if (key === "f" || key === "/") {
        setMode("lists");
        setListViewState("filtered");
        setFilterOpen(true);
        window.setTimeout(() => document.getElementById("list-search")?.focus(), 0);
      } else if (key === "w") setWalletPromptOpen(true);
      else if (key === "r") {
        data.refresh();
        setNotice("REFRESH REQUESTED");
      } else if (key === "e") {
        void data.exportList().then((filename) => setNotice(`EXPORTED: ${filename}`));
      } else if (key === "?") setHelpOpen(true);
      else if (key === "1" || key === "2" || key === "3") applyPreset(key);
      else if ((key === "j" || key === "arrowdown") && mode === "lists") {
        setCursor((current) => Math.min((data.list?.rows.length ?? 1) - 1, current + 1));
      } else if ((key === "k" || key === "arrowup") && mode === "lists") {
        setCursor((current) => Math.max(0, current - 1));
      } else if (key === "enter" && mode === "lists") {
        const row = data.list?.rows[cursor];
        if (row !== undefined) void inspect(row);
      } else if (key === "pagedown" && mode === "lists") {
        data.nextPage();
        setCursor(0);
      } else if (key === "pageup" && mode === "lists") {
        data.previousPage();
        setCursor(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyPreset, cursor, cycleView, data, filterOpen, helpOpen, inspect, mode, navigate, walletPromptOpen]);

  return useMemo(
    () => ({
      mode,
      listView,
      historyView,
      cursor,
      filterOpen,
      walletPromptOpen,
      helpOpen,
      notice,
      navigate,
      cycleView,
      toggleFilters: () => {
        setMode("lists");
        setListViewState("filtered");
        setFilterOpen((value) => !value);
      },
      openWalletPrompt: () => setWalletPromptOpen(true),
      closeOverlays: () => {
        setWalletPromptOpen(false);
        setHelpOpen(false);
      },
      toggleHelp: () => setHelpOpen((value) => !value),
      setCursor,
      inspect,
      submitWallet,
      applyPreset,
    }),
    [applyPreset, cursor, filterOpen, helpOpen, historyView, inspect, listView, mode, navigate, notice, submitWallet, walletPromptOpen],
  );
}
