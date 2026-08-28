import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, ClusterMapApi } from "../models/api";
import { validateDelta } from "../models/delta";
import type {
  ReviewPayload,
  AnalysisVersion,
  ChangelogResponse,
  ClusterDetail,
  DeltaPayload,
  GlobalMap,
  ListFilters,
  ListPage,
  Overview,
  QualityStats,
  VersionsResponse,
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

function searchParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function updateSearch(values: Readonly<Record<string, string | null>>): void {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function readStoredFocusWallet(): string | null {
  try {
    return normalizeEthereumAddress(window.localStorage.getItem(FOCUS_WALLET_STORAGE_KEY) ?? "");
  } catch {
    return null;
  }
}

export interface ClusterMapController {
  readonly versions: readonly AnalysisVersion[];
  readonly publishedVersionId: string | null;
  readonly selectedVersionId: string | null;
  readonly selectedVersion: AnalysisVersion | null;
  readonly changelog: ChangelogResponse | null;
  readonly review: ReviewPayload | null;
  readonly delta: DeltaPayload | null;
  readonly deltaEnabled: boolean;
  readonly deltaBaseId: string | null;
  readonly deltaHeadId: string | null;
  readonly overview: Overview | null;
  readonly stats: QualityStats | null;
  readonly cluster: ClusterDetail | null;
  readonly globalMap: GlobalMap | null;
  readonly wallet: WalletDetail | null;
  readonly reviewWallet: WalletDetail | null;
  readonly focusedWalletAddress: string | null;
  readonly focusedWallet: WalletDetail | null;
  readonly focusedWalletStatus: WalletProfileStatus;
  readonly list: ListPage | null;
  readonly filters: ListFilters;
  readonly loading: {
    readonly versions: boolean;
    readonly changelog: boolean;
    readonly review: boolean;
    readonly overview: boolean;
    readonly stats: boolean;
    readonly globalMap: boolean;
    readonly cluster: boolean;
    readonly wallet: boolean;
    readonly reviewWallet: boolean;
    readonly list: boolean;
    readonly delta: boolean;
  };
  readonly error: string | null;
  readonly resetViewKey: number;
  readonly setVersion: (id: string) => void;
  readonly setDeltaEnabled: (enabled: boolean) => void;
  readonly setDeltaBase: (id: string) => void;
  readonly setDeltaHead: (id: string) => void;
  readonly openCluster: (id: number) => Promise<void>;
  readonly inspectWallet: (address: string, clusterId?: number | null) => Promise<boolean>;
  readonly inspectReviewWallet: (address: string) => Promise<boolean>;
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
  const [versionIndex, setVersionIndex] = useState<VersionsResponse | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    () => searchParam("version"),
  );
  const [changelog, setChangelog] = useState<ChangelogResponse | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [deltaEnabled, setDeltaEnabledState] = useState(() => searchParam("delta") === "1");
  const [deltaBaseId, setDeltaBaseId] = useState<string | null>(() => searchParam("base"));
  const [deltaHeadId, setDeltaHeadId] = useState<string | null>(() => searchParam("head"));
  const [delta, setDelta] = useState<DeltaPayload | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [globalMap, setGlobalMap] = useState<GlobalMap | null>(null);
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [reviewWallet, setReviewWallet] = useState<WalletDetail | null>(null);
  const [focusedWalletAddress, setFocusedWalletAddress] = useState<string | null>(readStoredFocusWallet);
  const [focusedWallet, setFocusedWalletDetail] = useState<WalletDetail | null>(null);
  const [focusedWalletStatus, setFocusedWalletStatus] = useState<WalletProfileStatus>(
    focusedWalletAddress === null ? "unset" : "loading",
  );
  const [focusedWalletReloadKey, setFocusedWalletReloadKey] = useState(0);
  const [list, setList] = useState<ListPage | null>(null);
  const [filters, setFilters] = useState<ListFilters>(initialFilters);
  const [loading, setLoading] = useState({
    versions: true,
    changelog: true,
    review: true,
    overview: true,
    stats: true,
    globalMap: true,
    cluster: false,
    wallet: false,
    reviewWallet: false,
    list: true,
    delta: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const reviewWalletRequest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRef.current.versions(controller.signal),
      apiRef.current.changelog({}, controller.signal),
    ])
      .then(([index, timeline]) => {
        const ids = new Set(index.versions.map((version) => version.id));
        const requested = selectedVersionId;
        const selected = requested !== null && ids.has(requested)
          ? requested
          : index.published_version;
        const requestedBase = deltaBaseId;
        const base = requestedBase !== null && ids.has(requestedBase)
          ? requestedBase
          : index.published_version;
        const requestedHead = deltaHeadId;
        const head = requestedHead !== null && ids.has(requestedHead)
          ? requestedHead
          : (index.versions.at(-1)?.id ?? selected);
        setVersionIndex(index);
        setChangelog(timeline);
        setSelectedVersionId(deltaEnabled ? head : selected);
        setDeltaBaseId(base);
        setDeltaHeadId(head);
        updateSearch({
          version: deltaEnabled ? head : selected,
          base: deltaEnabled ? base : null,
          head: deltaEnabled ? head : null,
        });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading((current) => ({ ...current, versions: false, changelog: false }));
        }
      });
    return () => controller.abort();
    // Initial URL state is intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedVersionId === null || focusedWalletAddress === null) {
      if (focusedWalletAddress === null) {
        setFocusedWalletDetail(null);
        setFocusedWalletStatus("unset");
      }
      return;
    }
    const controller = new AbortController();
    setFocusedWalletStatus("loading");
    apiRef.current
      .wallet(focusedWalletAddress, selectedVersionId, controller.signal)
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
  }, [focusedWalletAddress, focusedWalletReloadKey, reloadKey, selectedVersionId]);

  useEffect(() => {
    if (selectedVersionId === null) return;
    const controller = new AbortController();
    setLoading((current) => ({ ...current, review: true, reviewWallet: false }));
    reviewWalletRequest.current += 1;
    setReviewWallet(null);
    apiRef.current
      .review(selectedVersionId, controller.signal)
      .then(setReview)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading((current) => ({ ...current, review: false }));
        }
      });
    return () => controller.abort();
  }, [reloadKey, selectedVersionId]);

  useEffect(() => {
    if (selectedVersionId === null) return;
    const controller = new AbortController();
    setLoading((current) => ({ ...current, overview: true, stats: true, globalMap: true }));
    setOverview(null);
    setStats(null);
    setGlobalMap(null);
    setCluster(null);
    setWallet(null);
    Promise.all([
      apiRef.current.overview(selectedVersionId, controller.signal),
      apiRef.current.stats(selectedVersionId, controller.signal),
      apiRef.current.globalMap(selectedVersionId, controller.signal),
    ])
      .then(([nextOverview, nextStats, nextMap]) => {
        setOverview(nextOverview);
        setStats(nextStats);
        setGlobalMap(nextMap);
        setResetViewKey((value) => value + 1);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading((current) => ({
            ...current,
            overview: false,
            stats: false,
            globalMap: false,
          }));
        }
      });
    return () => controller.abort();
  }, [reloadKey, selectedVersionId]);

  useEffect(() => {
    if (selectedVersionId === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading((current) => ({ ...current, list: true }));
      apiRef.current
        .list(filters, selectedVersionId, controller.signal)
        .then(setList)
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading((current) => ({ ...current, list: false }));
          }
        });
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, reloadKey, selectedVersionId]);

  useEffect(() => {
    if (!deltaEnabled || deltaBaseId === null || deltaHeadId === null) {
      setDelta(null);
      return;
    }
    const controller = new AbortController();
    setDelta(null);
    setLoading((current) => ({ ...current, delta: true }));
    apiRef.current
      .delta(deltaBaseId, deltaHeadId, controller.signal)
      .then(validateDelta)
      .then(setDelta)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading((current) => ({ ...current, delta: false }));
        }
      });
    return () => controller.abort();
  }, [deltaBaseId, deltaEnabled, deltaHeadId, reloadKey]);

  const setVersion = useCallback((id: string) => {
    if (!versionIndex?.versions.some((version) => version.id === id)) return;
    setSelectedVersionId(id);
    if (deltaEnabled) setDeltaHeadId(id);
    updateSearch({ version: id, head: deltaEnabled ? id : null, cluster: null, wallet: null });
  }, [deltaEnabled, versionIndex]);

  const setDeltaEnabled = useCallback((enabled: boolean) => {
    setDeltaEnabledState(enabled);
    if (enabled && deltaHeadId !== null) setSelectedVersionId(deltaHeadId);
    updateSearch({
      delta: enabled ? "1" : null,
      base: enabled ? deltaBaseId : null,
      head: enabled ? deltaHeadId : null,
      version: enabled && deltaHeadId !== null ? deltaHeadId : selectedVersionId,
      cluster: null,
      wallet: null,
    });
  }, [deltaBaseId, deltaHeadId, selectedVersionId]);

  const setDeltaBase = useCallback((id: string) => {
    if (!versionIndex?.versions.some((version) => version.id === id)) return;
    setDeltaBaseId(id);
    updateSearch({ base: id });
  }, [versionIndex]);

  const setDeltaHead = useCallback((id: string) => {
    if (!versionIndex?.versions.some((version) => version.id === id)) return;
    setDeltaHeadId(id);
    setSelectedVersionId(id);
    updateSearch({ version: id, head: id, cluster: null, wallet: null });
  }, [versionIndex]);

  const openCluster = useCallback(async (id: number) => {
    if (selectedVersionId === null) return;
    setLoading((current) => ({ ...current, cluster: true }));
    setWallet(null);
    try {
      const detail = await apiRef.current.cluster(id, selectedVersionId);
      setCluster(detail);
      setResetViewKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading((current) => ({ ...current, cluster: false }));
    }
  }, [selectedVersionId]);

  const inspectWallet = useCallback(async (address: string, clusterId?: number | null) => {
    if (selectedVersionId === null) return false;
    setLoading((current) => ({ ...current, wallet: true }));
    try {
      const clusterPromise = clusterId !== null
        && clusterId !== undefined
        && cluster?.cluster.id !== clusterId
        ? apiRef.current.cluster(clusterId, selectedVersionId)
        : Promise.resolve(null);
      const [nextCluster, detail] = await Promise.all([
        clusterPromise,
        apiRef.current.wallet(address, selectedVersionId),
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
  }, [cluster?.cluster.id, selectedVersionId]);

  const inspectReviewWallet = useCallback(async (address: string) => {
    if (selectedVersionId === null) return false;
    const request = reviewWalletRequest.current + 1;
    reviewWalletRequest.current = request;
    setLoading((current) => ({ ...current, reviewWallet: true }));
    try {
      const detail = await apiRef.current.wallet(address, selectedVersionId);
      if (reviewWalletRequest.current === request) setReviewWallet(detail);
      return true;
    } catch (reason) {
      if (reviewWalletRequest.current === request) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
      return false;
    } finally {
      if (reviewWalletRequest.current === request) {
        setLoading((current) => ({ ...current, reviewWallet: false }));
      }
    }
  }, [selectedVersionId]);

  const updateFilters = useCallback((patch: Partial<ListFilters>) => {
    setFilters((current) => ({ ...current, ...patch, offset: patch.offset ?? 0 }));
  }, []);

  const selectedVersion = versionIndex?.versions.find(
    (version) => version.id === selectedVersionId,
  ) ?? null;

  return useMemo(() => ({
    versions: versionIndex?.versions ?? [],
    publishedVersionId: versionIndex?.published_version ?? null,
    selectedVersionId,
    selectedVersion,
    changelog,
    review,
    delta,
    deltaEnabled,
    deltaBaseId,
    deltaHeadId,
    overview,
    stats,
    cluster,
    globalMap,
    wallet,
    reviewWallet,
    focusedWalletAddress,
    focusedWallet,
    focusedWalletStatus,
    list,
    filters,
    loading,
    error,
    resetViewKey,
    setVersion,
    setDeltaEnabled,
    setDeltaBase,
    setDeltaHead,
    openCluster,
    inspectWallet,
    inspectReviewWallet,
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
    previousPage: () => setFilters((current) => ({
      ...current,
      offset: Math.max(0, current.offset - current.limit),
    })),
    nextPage: () => setFilters((current) => ({
      ...current,
      offset: list === null || current.offset + current.limit >= list.total
        ? current.offset
        : current.offset + current.limit,
    })),
    refresh: () => setReloadKey((value) => value + 1),
    exportList: async () => {
      const { blob, filename } = await apiRef.current.exportList(
        filters,
        selectedVersionId ?? undefined,
      );
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
  }), [
    changelog,
    review,
    reviewWallet,
    cluster,
    delta,
    deltaBaseId,
    deltaEnabled,
    deltaHeadId,
    error,
    filters,
    focusedWallet,
    focusedWalletAddress,
    focusedWalletStatus,
    globalMap,
    inspectWallet,
    inspectReviewWallet,
    list,
    loading,
    openCluster,
    overview,
    stats,
    resetViewKey,
    selectedVersion,
    selectedVersionId,
    setDeltaBase,
    setDeltaEnabled,
    setDeltaHead,
    setVersion,
    updateFilters,
    versionIndex,
    wallet,
  ]);
}
