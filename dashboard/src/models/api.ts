import type { ClusterDetail, GlobalMap, ListFilters, ListPage, Overview, WalletDetail } from "./domain";

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

function listQuery(filters: ListFilters, includePaging: boolean): URLSearchParams {
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
  return new URLSearchParams(values);
}

export class ClusterMapApi {
  constructor(private readonly baseUrl = "/api/v1") {}

  async overview(signal?: AbortSignal): Promise<Overview> {
    return readJson<Overview>(await fetch(`${this.baseUrl}/overview`, { signal }));
  }

  async globalMap(signal?: AbortSignal): Promise<GlobalMap> {
    return readJson<GlobalMap>(await fetch(`${this.baseUrl}/map/global`, { signal }));
  }

  async cluster(id: number, signal?: AbortSignal): Promise<ClusterDetail> {
    return readJson<ClusterDetail>(await fetch(`${this.baseUrl}/clusters/${id}`, { signal }));
  }

  async wallet(address: string, signal?: AbortSignal): Promise<WalletDetail> {
    return readJson<WalletDetail>(await fetch(`${this.baseUrl}/wallets/${address}`, { signal }));
  }

  async list(filters: ListFilters, signal?: AbortSignal): Promise<ListPage> {
    const query = listQuery(filters, true);
    return readJson<ListPage>(await fetch(`${this.baseUrl}/list?${query}`, { signal }));
  }

  async exportList(filters: ListFilters): Promise<{ blob: Blob; filename: string }> {
    const response = await fetch(`${this.baseUrl}/list/export?${listQuery(filters, false)}`);
    if (!response.ok) {
      await readJson(response);
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "the-list.json";
    return { blob: await response.blob(), filename };
  }
}
