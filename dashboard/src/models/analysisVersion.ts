import type { VersionsResponse } from "./domain";

export const DEFAULT_ANALYSIS_VERSION_ID = "2026-08-25-v2h";

export function defaultAnalysisVersionId(index: VersionsResponse): string {
  return index.versions.some((version) => version.id === DEFAULT_ANALYSIS_VERSION_ID)
    ? DEFAULT_ANALYSIS_VERSION_ID
    : index.published_version;
}
