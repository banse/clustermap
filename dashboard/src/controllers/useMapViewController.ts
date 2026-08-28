import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClusterMapController } from "./useClusterMapController";
import type { DeltaClass } from "../models/domain";
import { normalizeEthereumAddress } from "../models/walletProfile";

export type MapScope = "global" | "cluster";
export type GlobalVisualView = "wallets" | "clusters";
export type AppPage = "welcome" | "map" | "list" | "stats" | "profile" | "changelog" | "review";

function readPage(): AppPage {
  const value = new URLSearchParams(window.location.search).get("page");
  return value === "map" || value === "list" || value === "stats" || value === "profile" || value === "changelog" || value === "review"
    ? value
    : "welcome";
}

function readGlobalView(): GlobalVisualView {
  return new URLSearchParams(window.location.search).get("view") === "wallets"
    ? "wallets"
    : "clusters";
}

function updateSearch(values: Readonly<Record<string, string | null>>): void {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export interface MapViewController {
  readonly scope: MapScope;
  readonly globalView: GlobalVisualView;
  readonly page: AppPage;
  readonly walletDraft: string;
  readonly walletDraftError: string | null;
  readonly deltaFilter: DeltaClass | "all";
  readonly selectWallet: (address: string, clusterId?: number | null) => Promise<void>;
  readonly showCluster: (clusterId: number) => Promise<void>;
  readonly showGlobal: () => void;
  readonly setGlobalView: (view: GlobalVisualView) => void;
  readonly showWelcome: () => void;
  readonly showMap: () => void;
  readonly showList: () => void;
  readonly showStats: () => void;
  readonly showProfile: () => void;
  readonly showWalletProfile: (address: string) => void;
  readonly showChangelog: () => void;
  readonly showReview: () => void;
  readonly showFocusedWalletOnMap: () => Promise<void>;
  readonly setWalletDraft: (value: string) => void;
  readonly saveFocusedWallet: () => void;
  readonly clearFocusedWallet: () => void;
  readonly setDeltaFilter: (value: DeltaClass | "all") => void;
  readonly closeWallet: () => void;
}

export function useMapViewController(data: ClusterMapController): MapViewController {
  const [scope, setScope] = useState<MapScope>("global");
  const [globalView, setGlobalViewState] = useState<GlobalVisualView>(readGlobalView);
  const [page, setPage] = useState<AppPage>(readPage);
  const [walletDraft, setWalletDraftState] = useState(data.focusedWalletAddress ?? "");
  const [walletDraftError, setWalletDraftError] = useState<string | null>(null);
  const [deltaFilter, setDeltaFilter] = useState<DeltaClass | "all">("all");
  const deepLinkKey = useRef<string | null>(null);

  useEffect(() => {
    setWalletDraftState(data.focusedWalletAddress ?? "");
  }, [data.focusedWalletAddress]);

  const selectWallet = useCallback(async (address: string, clusterId?: number | null) => {
    const opened = await data.inspectWallet(address, clusterId);
    if (opened) {
      deepLinkKey.current = `${data.selectedVersionId ?? ""}:${clusterId ?? ""}:${address}`;
      updateSearch({
        page: "map",
        wallet: address,
        cluster: clusterId === null || clusterId === undefined ? null : String(clusterId),
      });
    }
  }, [data]);

  const showCluster = useCallback(async (clusterId: number) => {
    data.closeWallet();
    await data.openCluster(clusterId);
    setScope("cluster");
    setPage("map");
    deepLinkKey.current = `${data.selectedVersionId ?? ""}:${clusterId}:`;
    updateSearch({ page: "map", cluster: String(clusterId), wallet: null });
  }, [data]);

  useEffect(() => {
    if (data.selectedVersionId === null) return;
    const query = new URLSearchParams(window.location.search);
    const clusterValue = query.get("cluster");
    const walletValue = normalizeEthereumAddress(query.get("wallet") ?? "");
    const key = `${data.selectedVersionId}:${clusterValue ?? ""}:${walletValue ?? ""}`;
    if (deepLinkKey.current === key) return;
    deepLinkKey.current = key;
    const clusterId = clusterValue === null ? null : Number(clusterValue);
    if (clusterId === null || !Number.isInteger(clusterId) || clusterId < 0) {
      setScope("global");
      if (walletValue !== null && page === "map") void data.inspectWallet(walletValue, null);
      return;
    }
    void data.openCluster(clusterId).then(() => {
      setScope("cluster");
      setPage("map");
      if (walletValue !== null) void data.inspectWallet(walletValue, clusterId);
    });
  }, [data, page]);

  const showFocusedWalletOnMap = useCallback(async () => {
    const focus = data.focusedWallet;
    setPage("map");
    if (focus === null) return;
    if (focus.cluster !== null) {
      const opened = await data.inspectWallet(focus.wallet.address, focus.cluster.id);
      if (opened) setScope("cluster");
      if (opened) {
        deepLinkKey.current = `${data.selectedVersionId ?? ""}:${focus.cluster.id}:${focus.wallet.address}`;
        updateSearch({
          page: "map",
          cluster: String(focus.cluster.id),
          wallet: focus.wallet.address,
        });
      }
      return;
    }
    data.backToOverview();
    setScope("global");
    setGlobalViewState("wallets");
    await data.inspectWallet(focus.wallet.address, null);
    deepLinkKey.current = `${data.selectedVersionId ?? ""}::${focus.wallet.address}`;
    updateSearch({ page: "map", view: "wallets", cluster: null, wallet: focus.wallet.address });
  }, [data]);

  const showWalletProfile = useCallback((address: string) => {
    if (!data.setFocusedWallet(address)) return;
    setPage("profile");
    updateSearch({ page: "profile", cluster: null, wallet: null });
  }, [data]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (data.wallet !== null) {
        event.preventDefault();
        data.closeWallet();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data]);

  return useMemo(() => ({
    scope,
    globalView,
    page,
    walletDraft,
    walletDraftError,
    deltaFilter,
    selectWallet,
    showCluster,
    showGlobal: () => {
      data.backToOverview();
      setScope("global");
      setPage("map");
      updateSearch({ page: "map", cluster: null, wallet: null });
    },
    setGlobalView: (view) => {
      data.closeWallet();
      setGlobalViewState(view);
      updateSearch({ view, wallet: null });
    },
    showWelcome: () => {
      setPage("welcome");
      updateSearch({ page: "welcome", cluster: null, wallet: null });
    },
    showMap: () => {
      setPage("map");
      updateSearch({ page: "map" });
    },
    showList: () => {
      data.setListView("clean");
      setPage("list");
      updateSearch({ page: "list", cluster: null, wallet: null });
    },
    showStats: () => {
      setPage("stats");
      updateSearch({ page: "stats", cluster: null, wallet: null });
    },
    showProfile: () => {
      setPage("profile");
      updateSearch({ page: "profile", cluster: null, wallet: null });
    },
    showWalletProfile,
    showChangelog: () => {
      setPage("changelog");
      updateSearch({ page: "changelog", cluster: null, wallet: null });
    },
    showReview: () => {
      setPage("review");
      updateSearch({ page: "review", cluster: null, wallet: null });
    },
    showFocusedWalletOnMap,
    setWalletDraft: (value) => {
      setWalletDraftState(value);
      setWalletDraftError(null);
    },
    saveFocusedWallet: () => {
      const normalized = normalizeEthereumAddress(walletDraft);
      if (normalized === null) {
        setWalletDraftError("Enter a 42-character Ethereum address beginning with 0x.");
        return;
      }
      data.setFocusedWallet(normalized);
      setWalletDraftState(normalized);
      setWalletDraftError(null);
    },
    clearFocusedWallet: () => {
      data.clearFocusedWallet();
      setWalletDraftState("");
      setWalletDraftError(null);
    },
    setDeltaFilter,
    closeWallet: () => {
      data.closeWallet();
      updateSearch({ wallet: null });
    },
  }), [data, deltaFilter, globalView, page, scope, selectWallet, showCluster, showFocusedWalletOnMap, showWalletProfile, walletDraft, walletDraftError]);
}
