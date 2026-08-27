import type { AnalysisVersion } from "../models/domain";

interface VersionControlsProps {
  readonly versions: readonly AnalysisVersion[];
  readonly selectedId: string | null;
  readonly deltaEnabled: boolean;
  readonly baseId: string | null;
  readonly headId: string | null;
  readonly onVersion: (id: string) => void;
  readonly onDeltaEnabled: (enabled: boolean) => void;
  readonly onBase: (id: string) => void;
  readonly onHead: (id: string) => void;
}

export function VersionControls({
  versions,
  selectedId,
  deltaEnabled,
  baseId,
  headId,
  onVersion,
  onDeltaEnabled,
  onBase,
  onHead,
}: VersionControlsProps) {
  const selected = versions.find((version) => version.id === selectedId) ?? null;
  return (
    <section className="version-controls" aria-label="Analysis version">
      <div className="version-controls__identity">
        <span>ANALYSIS VERSION</span>
        <strong>{selected?.label ?? "LOADING VERSIONS"}</strong>
        {selected === null ? null : (
          <small>{selected.published ? "PUBLISHED DEFAULT" : selected.stage.toUpperCase()} · {selected.id}</small>
        )}
      </div>
      <label>
        <span>SHOW</span>
        <select
          aria-label="Selected analysis version"
          value={selectedId ?? ""}
          onChange={(event) => onVersion(event.target.value)}
          disabled={versions.length === 0 || deltaEnabled}
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label} · {version.published ? "published" : version.stage}
            </option>
          ))}
        </select>
      </label>
      <label className="version-controls__delta-toggle">
        <input
          type="checkbox"
          checked={deltaEnabled}
          onChange={(event) => onDeltaEnabled(event.target.checked)}
          disabled={versions.length < 2}
        />
        <span>COMPARE VERSIONS</span>
      </label>
      {deltaEnabled ? (
        <div className="version-controls__comparison" aria-label="Directional comparison">
          <label>
            <span>BASE</span>
            <select aria-label="Base version" value={baseId ?? ""} onChange={(event) => onBase(event.target.value)}>
              {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
            </select>
          </label>
          <b aria-hidden="true">→</b>
          <label>
            <span>HEAD</span>
            <select aria-label="Head version" value={headId ?? ""} onChange={(event) => onHead(event.target.value)}>
              {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}
