import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, ClusterMapApi } from "../models/api";
import type {
  ClusterDetail,
  GlobalMap,
  ListFilters,
  ListPage,
  Overview,
  WalletDetail,
} from "../models/domain";
import {
  FOCUS_WALLET_STORAGE_KEY,
  normalizeEthereumAddress,
  type WalletProfileStatus,
} from "../models/walletProfile";

const initialFilters: ListFilters = {
  query: "",
  link: "all",
  evidence: "all",
  preset: "none",
  offset: 0,
  limit: 50,
};

function readStoredFocusWallet(): string | null {
  try {
    return normalizeEthereumAddress(window.localStorage.getItem(FOCUS_WALLET_STORAGE_KEY) ?? "");
  } catch {
    return null;
  }
}

export interface ClusterMapController {
  readonly overview: Overview | null;
  readonly cluster: ClusterDetail | null;
  readonly globalMap: GlobalMap | null;
  readonly wallet: WalletDetail | null;
  readonly focusedWalletAddress: string | null;
  readonly focusedWallet: WalletDetail | null;
  readonly focusedWalletStatus: WalletProfileStatus;
  readonly list: ListPage | null;
  readonly filters: ListFilters;
  readonly loading: {
    readonly overview: boolean;
    readonly globalMap: boolean;
    readonly cluster: boolean;
    readonly wallet: boolean;
    readonly list: boolean;
  };
  readonly error: string | null;
  readonly resetViewKey: number;
  readonly openCluster: (id: number) => Promise<void>;
  readonly inspectWallet: (address: string, clusterId?: number | null) => Promise<boolean>;
  readonly setFocusedWallet: (address: string) => boolean;
  readonly clearFocusedWallet: () => void;
  readonly backToOverview: () => void;
  readonly closeWallet: () => void;
  readonly setQuery: (query: string) => void;
  readonly setLinkFilter: (link: ListFilters["link"]) => void;
  readonly setEvidenceFilter: (evidence: ListFilters["evidence"]) => void;
  readonly setPreset: (preset: ListFilters["preset"]) => void;
  readonly setListView: (view: "raw" | "clean" | "filtered") => void;
  readonly previousPage: () => void;
  readonly nextPage: () => void;
  readonly refresh: () => void;
  readonly exportList: () => Promise<string>;
  readonly resetView: () => void;
  readonly clearError: () => void;
}

export function useClusterMapController(apiOverride?: ClusterMapApi): ClusterMapController {
  const apiRef = useRef(apiOverride ?? new ClusterMapApi());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [globalMap, setGlobalMap] = useState<GlobalMap | null>(null);
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [focusedWalletAddress, setFocusedWalletAddress] = useState<string | null>(readStoredFocusWallet);
  const [focusedWallet, setFocusedWalletDetail] = useState<WalletDetail | null>(null);
  const [focusedWalletStatus, setFocusedWalletStatus] = useState<WalletProfileStatus>(
    focusedWalletAddress === null ? "unset" : "loading",
  );
  const [focusedWalletReloadKey, setFocusedWalletReloadKey] = useState(0);
  const [list, setList] = useState<ListPage | null>(null);
  const [filters, setFilters] = useState<ListFilters>(initialFilters);
  const [loading, setLoading] = useState({
    overview: true,
    globalMap: true,
    cluster: false,
    wallet: false,
    list: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (focusedWalletAddress === null) {
      setFocusedWalletDetail(null);
      setFocusedWalletStatus("unset");
      return;
    }
    const controller = new AbortController();
    setFocusedWalletStatus("loading");
    apiRef.current
      .wallet(focusedWalletAddress, controller.signal)
      .then((detail) => {
        setFocusedWalletDetail(detail);
        setFocusedWalletStatus("listed");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setFocusedWalletDetail(null);
        if (reason instanceof ApiError && reason.status === 404) {
          setFocusedWalletStatus("not-listed");
          return;
        }
        setFocusedWalletStatus("error");
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [focusedWalletAddress, focusedWalletReloadKey, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading((current) => ({ ...current, overview: true }));
    apiRef.current
      .overview(controller.signal)
      .then(setOverview)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading((current) => ({ ...current, overview: false }));
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading((current) => ({ ...current, globalMap: true }));
    apiRef.current
      .globalMap(controller.signal)
      .then(setGlobalMap)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading((current) => ({ ...current, globalMap: false }));
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading((current) => ({ ...current, list: true }));
      apiRef.current
        .list(filters, controller.signal)
        .then(setList)
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading((current) => ({ ...current, list: false }));
        });
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, reloadKey]);

  const openCluster = useCallback(async (id: number) => {
    setLoading((current) => ({ ...current, cluster: true }));
    setWallet(null);
    try {
      const detail = await apiRef.current.cluster(id);
      setCluster(detail);
      setResetViewKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading((current) => ({ ...current, cluster: false }));
    }
  }, []);

  const inspectWallet = useCallback(
    async (address: string, clusterId?: number | null) => {
      setLoading((current) => ({ ...current, wallet: true }));
      try {
        const clusterPromise =
          clusterId !== null && clusterId !== undefined && cluster?.cluster.id !== clusterId
            ? apiRef.current.cluster(clusterId)
            : Promise.resolve(null);
        const [nextCluster, detail] = await Promise.all([
          clusterPromise,
          apiRef.current.wallet(address),
        ]);
        if (nextCluster !== null) {
          setCluster(nextCluster);
          setResetViewKey((value) => value + 1);
        }
        setWallet(detail);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        return false;
      } finally {
        setLoading((current) => ({ ...current, wallet: false }));
      }
    },
    [cluster?.cluster.id],
  );

  const updateFilters = useCallback((patch: Partial<ListFilters>) => {
    setFilters((current) => ({ ...current, ...patch, offset: patch.offset ?? 0 }));
  }, []);

  return useMemo(
    () => ({
      overview,
      cluster,
      globalMap,
      wallet,
      focusedWalletAddress,
      focusedWallet,
      focusedWalletStatus,
      list,
      filters,
      loading,
      error,
      resetViewKey,
      openCluster,
      inspectWallet,
      setFocusedWallet: (address: string) => {
        const normalized = normalizeEthereumAddress(address);
        if (normalized === null) return false;
        try {
          window.localStorage.setItem(FOCUS_WALLET_STORAGE_KEY, normalized);
        } catch {
          // The in-memory focus still works when browser storage is unavailable.
        }
        setFocusedWalletDetail(null);
        setFocusedWalletStatus("loading");
        setFocusedWalletAddress(normalized);
        setFocusedWalletReloadKey((value) => value + 1);
        return true;
      },
      clearFocusedWallet: () => {
        try {
          window.localStorage.removeItem(FOCUS_WALLET_STORAGE_KEY);
        } catch {
          // Clearing the in-memory focus is sufficient when storage is unavailable.
        }
        setFocusedWalletAddress(null);
        setFocusedWalletDetail(null);
        setFocusedWalletStatus("unset");
      },
      backToOverview: () => {
        setCluster(null);
        setWallet(null);
        setResetViewKey((value) => value + 1);
      },
      closeWallet: () => setWallet(null),
      setQuery: (query: string) => updateFilters({ query }),
      setLinkFilter: (link: ListFilters["link"]) => updateFilters({ link }),
      setEvidenceFilter: (evidence: ListFilters["evidence"]) => updateFilters({ evidence }),
      setPreset: (preset: ListFilters["preset"]) => updateFilters({ preset }),
      setListView: (view: "raw" | "clean" | "filtered") => {
        if (view === "raw") {
          updateFilters({ query: "", link: "all", evidence: "all", preset: "none" });
        } else if (view === "clean") {
          updateFilters({ query: "", link: "unlinked", evidence: "all", preset: "none" });
        }
      },
      previousPage: () =>
        setFilters((current) => ({
          ...current,
          offset: Math.max(0, current.offset - current.limit),
        })),
      nextPage: () =>
        setFilters((current) => ({
          ...current,
          offset:
            list === null || current.offset + current.limit >= list.total
              ? current.offset
              : current.offset + current.limit,
        })),
      refresh: () => setReloadKey((value) => value + 1),
      exportList: async () => {
        const { blob, filename } = await apiRef.current.exportList(filters);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        return filename;
      },
      resetView: () => setResetViewKey((value) => value + 1),
      clearError: () => setError(null),
    }),
    [
      cluster,
      error,
      filters,
      focusedWallet,
      focusedWalletAddress,
      focusedWalletStatus,
      globalMap,
      inspectWallet,
      list,
      loading,
      openCluster,
      overview,
      resetViewKey,
      updateFilters,
      wallet,
    ],
  );
}
