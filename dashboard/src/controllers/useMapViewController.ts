import { useCallback, useEffect, useMemo, useState } from "react";

import type { ClusterMapController } from "./useClusterMapController";
import { normalizeEthereumAddress } from "../models/walletProfile";

export type MapScope = "global" | "cluster";
export type GlobalVisualView = "wallets" | "clusters";
export type AppPage = "welcome" | "map" | "profile";

export interface MapViewController {
  readonly scope: MapScope;
  readonly globalView: GlobalVisualView;
  readonly page: AppPage;
  readonly walletDraft: string;
  readonly walletDraftError: string | null;
  readonly selectWallet: (address: string, clusterId?: number | null) => Promise<void>;
  readonly showCluster: (clusterId: number) => Promise<void>;
  readonly showGlobal: () => void;
  readonly setGlobalView: (view: GlobalVisualView) => void;
  readonly showWelcome: () => void;
  readonly showMap: () => void;
  readonly showProfile: () => void;
  readonly showFocusedWalletOnMap: () => Promise<void>;
  readonly setWalletDraft: (value: string) => void;
  readonly saveFocusedWallet: () => void;
  readonly clearFocusedWallet: () => void;
  readonly closeWallet: () => void;
}

export function useMapViewController(data: ClusterMapController): MapViewController {
  const [scope, setScope] = useState<MapScope>("global");
  const [globalView, setGlobalViewState] = useState<GlobalVisualView>("clusters");
  const [page, setPage] = useState<AppPage>("welcome");
  const [walletDraft, setWalletDraftState] = useState(data.focusedWalletAddress ?? "");
  const [walletDraftError, setWalletDraftError] = useState<string | null>(null);

  useEffect(() => {
    setWalletDraftState(data.focusedWalletAddress ?? "");
  }, [data.focusedWalletAddress]);

  const selectWallet = useCallback(async (address: string, clusterId?: number | null) => {
    await data.inspectWallet(address, clusterId);
  }, [data]);

  const showCluster = useCallback(async (clusterId: number) => {
    data.closeWallet();
    await data.openCluster(clusterId);
    setScope("cluster");
    setPage("map");
  }, [data]);

  const showFocusedWalletOnMap = useCallback(async () => {
    const focus = data.focusedWallet;
    setPage("map");
    if (focus === null) return;
    if (focus.cluster !== null) {
      const opened = await data.inspectWallet(focus.wallet.address, focus.cluster.id);
      if (opened) setScope("cluster");
      return;
    }
    data.backToOverview();
    setScope("global");
    setGlobalViewState("wallets");
    await data.inspectWallet(focus.wallet.address, null);
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
    selectWallet,
    showCluster,
    showGlobal: () => {
      data.backToOverview();
      setScope("global");
      setPage("map");
    },
    setGlobalView: (view) => {
      data.closeWallet();
      setGlobalViewState(view);
    },
    showWelcome: () => setPage("welcome"),
    showMap: () => setPage("map"),
    showProfile: () => setPage("profile"),
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
    closeWallet: data.closeWallet,
  }), [data, globalView, page, scope, selectWallet, showCluster, showFocusedWalletOnMap, walletDraft, walletDraftError]);
}
