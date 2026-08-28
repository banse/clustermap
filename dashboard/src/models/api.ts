import type {
  ChangelogKind,
  ChangelogResponse,
  ClusterDetail,
  DeltaPayload,
  GlobalMap,
  ListFilters,
  ListPage,
  Overview,
  QualityStats,
  ReviewPayload,
  VersionsResponse,
  WalletDetail,
} from "./domain";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(payload?.detail ?? `Request failed (${response.status})`, response.status);
  }
  return (await response.json()) as T;
}

function listQuery(filters: ListFilters, includePaging: boolean, version?: string): URLSearchParams {
  const values: Record<string, string> = {
    q: filters.query,
    link: filters.link,
    evidence: filters.evidence,
    preset: filters.preset,
  };
  if (includePaging) {
    values.offset = String(filters.offset);
    values.limit = String(filters.limit);
  }
  if (version !== undefined) values.version = version;
  return new URLSearchParams(values);
}

function versionQuery(version?: string): string {
  return version === undefined ? "" : `?${new URLSearchParams({ version })}`;
}

export class ClusterMapApi {
  constructor(private readonly baseUrl = "/api/v1") {}

  async versions(signal?: AbortSignal): Promise<VersionsResponse> {
    return readJson<VersionsResponse>(await fetch(`${this.baseUrl}/versions`, { signal }));
  }

  async changelog(
    filters: { kind?: ChangelogKind; from?: string; to?: string } = {},
    signal?: AbortSignal,
  ): Promise<ChangelogResponse> {
    const query = new URLSearchParams();
    if (filters.kind !== undefined) query.set("kind", filters.kind);
    if (filters.from !== undefined) query.set("from", filters.from);
    if (filters.to !== undefined) query.set("to", filters.to);
    const suffix = query.size === 0 ? "" : `?${query}`;
    return readJson<ChangelogResponse>(
      await fetch(`${this.baseUrl}/changelog${suffix}`, { signal }),
    );
  }

  async overview(version?: string, signal?: AbortSignal): Promise<Overview> {
    return readJson<Overview>(
      await fetch(`${this.baseUrl}/overview${versionQuery(version)}`, { signal }),
    );
  }

  async stats(version?: string, signal?: AbortSignal): Promise<QualityStats> {
    return readJson<QualityStats>(
      await fetch(`${this.baseUrl}/stats${versionQuery(version)}`, { signal }),
    );
  }

  async globalMap(version?: string, signal?: AbortSignal): Promise<GlobalMap> {
    return readJson<GlobalMap>(
      await fetch(`${this.baseUrl}/map/global${versionQuery(version)}`, { signal }),
    );
  }

  async cluster(id: number, version?: string, signal?: AbortSignal): Promise<ClusterDetail> {
    return readJson<ClusterDetail>(
      await fetch(`${this.baseUrl}/clusters/${id}${versionQuery(version)}`, { signal }),
    );
  }

  async wallet(address: string, version?: string, signal?: AbortSignal): Promise<WalletDetail> {
    return readJson<WalletDetail>(
      await fetch(`${this.baseUrl}/wallets/${address}${versionQuery(version)}`, { signal }),
    );
  }

  async list(filters: ListFilters, version?: string, signal?: AbortSignal): Promise<ListPage> {
    const query = listQuery(filters, true, version);
    return readJson<ListPage>(await fetch(`${this.baseUrl}/list?${query}`, { signal }));
  }

  async review(version?: string, signal?: AbortSignal): Promise<ReviewPayload> {
    const suffix = version === undefined ? "" : `?version=${encodeURIComponent(version)}`;
    return readJson(await fetch(`${this.baseUrl}/review${suffix}`, { signal }));
  }

  async delta(base: string, head: string, signal?: AbortSignal): Promise<DeltaPayload> {
    const query = new URLSearchParams({ base, head });
    return readJson<DeltaPayload>(await fetch(`${this.baseUrl}/delta?${query}`, { signal }));
  }

  async exportList(filters: ListFilters, version?: string): Promise<{ blob: Blob; filename: string }> {
    const response = await fetch(
      `${this.baseUrl}/list/export?${listQuery(filters, false, version)}`,
    );
    if (!response.ok) {
      await readJson(response);
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "the-list.json";
    return { blob: await response.blob(), filename };
  }
}
