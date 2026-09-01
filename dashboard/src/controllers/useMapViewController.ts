import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClusterMapController } from "./useClusterMapController";
import type { DeltaClass } from "../models/domain";
import { normalizeEthereumAddress } from "../models/walletProfile";

export type MapScope = "global" | "cluster";
export type GlobalVisualView = "wallets" | "clusters";
export type AppPage = "welcome" | "map" | "list" | "stats" | "profile" | "changelog" | "review" | "algorithm";

function readPage(): AppPage {
  const value = new URLSearchParams(window.location.search).get("page");
  return value === "map" || value === "list" || value === "stats" || value === "profile" || value === "changelog" || value === "review" || value === "algorithm"
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
  readonly selectedRuleId: string | null;
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
  readonly showAlgorithm: () => void;
  readonly showFocusedWalletOnMap: () => Promise<void>;
  readonly setWalletDraft: (value: string) => void;
  readonly saveFocusedWallet: () => void;
  readonly clearFocusedWallet: () => void;
  readonly setDeltaFilter: (value: DeltaClass | "all") => void;
  readonly selectRule: (ruleId: string | null) => void;
  readonly closeWallet: () => void;
}

export function useMapViewController(data: ClusterMapController): MapViewController {
  const [scope, setScope] = useState<MapScope>("global");
  const [globalView, setGlobalViewState] = useState<GlobalVisualView>(readGlobalView);
  const [page, setPage] = useState<AppPage>(readPage);
  const [walletDraft, setWalletDraftState] = useState(data.focusedWalletAddress ?? "");
  const [walletDraftError, setWalletDraftError] = useState<string | null>(null);
  const [deltaFilter, setDeltaFilter] = useState<DeltaClass | "all">("all");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(() => (
    new URLSearchParams(window.location.search).get("rule")
  ));
  const deepLinkKey = useRef<string | null>(null);
  const ruleVersion = useRef(data.selectedVersionId);

  useEffect(() => {
    setWalletDraftState(data.focusedWalletAddress ?? "");
  }, [data.focusedWalletAddress]);

  const selectWallet = useCallback(async (address: string, clusterId?: number | null) => {
    setSelectedRuleId(null);
    updateSearch({ rule: null });
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
    setSelectedRuleId(null);
    await data.openCluster(clusterId);
    setScope("cluster");
    setPage("map");
    deepLinkKey.current = `${data.selectedVersionId ?? ""}:${clusterId}:`;
    updateSearch({ page: "map", cluster: String(clusterId), wallet: null, rule: null });
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

  useEffect(() => {
    if (ruleVersion.current === data.selectedVersionId) return;
    ruleVersion.current = data.selectedVersionId;
    setSelectedRuleId(null);
    updateSearch({ rule: null });
  }, [data.selectedVersionId]);

  useEffect(() => {
    if (data.wallet === null || selectedRuleId === null) return;
    if (data.wallet.related_edges.some((edge) => edge.rule_id === selectedRuleId)) return;
    setSelectedRuleId(null);
    updateSearch({ rule: null });
  }, [data.wallet, selectedRuleId]);

  const showFocusedWalletOnMap = useCallback(async () => {
    const focus = data.focusedWallet;
    setSelectedRuleId(null);
    updateSearch({ rule: null });
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
    setSelectedRuleId(null);
    setPage("profile");
    updateSearch({ page: "profile", cluster: null, wallet: null, rule: null });
  }, [data]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (data.wallet !== null) {
        event.preventDefault();
        data.closeWallet();
        setSelectedRuleId(null);
        updateSearch({ wallet: null, rule: null });
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
    selectedRuleId,
    selectWallet,
    showCluster,
    showGlobal: () => {
      data.backToOverview();
      setSelectedRuleId(null);
      setScope("global");
      setPage("map");
      updateSearch({ page: "map", cluster: null, wallet: null, rule: null });
    },
    setGlobalView: (view) => {
      data.closeWallet();
      setSelectedRuleId(null);
      setGlobalViewState(view);
      updateSearch({ view, wallet: null, rule: null });
    },
    showWelcome: () => {
      setPage("welcome");
      setSelectedRuleId(null);
      updateSearch({ page: "welcome", cluster: null, wallet: null, rule: null });
    },
    showMap: () => {
      setPage("map");
      updateSearch({ page: "map" });
    },
    showList: () => {
      data.setListView("clean");
      setPage("list");
      setSelectedRuleId(null);
      updateSearch({ page: "list", cluster: null, wallet: null, rule: null });
    },
    showStats: () => {
      setPage("stats");
      setSelectedRuleId(null);
      updateSearch({ page: "stats", cluster: null, wallet: null, rule: null });
    },
    showProfile: () => {
      setPage("profile");
      setSelectedRuleId(null);
      updateSearch({ page: "profile", cluster: null, wallet: null, rule: null });
    },
    showWalletProfile,
    showChangelog: () => {
      setPage("changelog");
      setSelectedRuleId(null);
      updateSearch({ page: "changelog", cluster: null, wallet: null, rule: null });
    },
    showReview: () => {
      setPage("review");
      setSelectedRuleId(null);
      updateSearch({ page: "review", cluster: null, wallet: null, rule: null });
    },
    showAlgorithm: () => {
      data.closeWallet();
      setPage("algorithm");
      setSelectedRuleId(null);
      updateSearch({ page: "algorithm", cluster: null, wallet: null, rule: null });
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
    selectRule: (ruleId) => {
      setSelectedRuleId(ruleId);
      updateSearch({ rule: ruleId });
    },
    closeWallet: () => {
      data.closeWallet();
      setSelectedRuleId(null);
      updateSearch({ wallet: null, rule: null });
    },
  }), [data, deltaFilter, globalView, page, scope, selectWallet, selectedRuleId, showCluster, showFocusedWalletOnMap, showWalletProfile, walletDraft, walletDraftError]);
}
