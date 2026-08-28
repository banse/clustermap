import type { ClusterMapController } from "../controllers/useClusterMapController";
import type { TerminalController } from "../controllers/useTerminalController";
import type { ListFilters, Overview } from "../models/domain";
import { bandLabel, formatCount, formatEth } from "../models/presentation";
import { PRESETS } from "../models/terminal";
import { AddressLink } from "./AddressLink";

interface ListScreenProps {
  readonly data: ClusterMapController;
  readonly terminal: TerminalController;
  readonly overview: Overview;
}

export function ListScreen({ data, terminal, overview }: ListScreenProps) {
  const page = data.list;
  const end = page === null ? 0 : Math.min(page.offset + page.rows.length, page.total);
  const sourceLabel = terminal.listView === "raw" ? "RAW CONTRACT ORDER" : terminal.listView === "clean" ? "NO GROUP LINK" : "FILTER PIPELINE";

  return (
    <section className="screen-stack" aria-labelledby="list-screen-title">
      <div className="terminal-hero terminal-hero--list">
        <div>
          <span>THE LIST / {terminal.listView.toUpperCase()}</span>
          <h1 id="list-screen-title">{sourceLabel}</h1>
        </div>
        <dl>
          <div><dt>MATCHED</dt><dd>{page === null ? "—" : formatCount(page.total)}</dd></div>
          <div><dt>POPULATION</dt><dd>{formatCount(overview.totals.population)}</dd></div>
          <div><dt>PAGE</dt><dd>{page === null || page.total === 0 ? "0" : `${formatCount(page.offset + 1)}–${formatCount(end)}`}</dd></div>
          <div><dt>PRESET</dt><dd>{data.filters.preset === "none" ? "OFF" : data.filters.preset.toUpperCase()}</dd></div>
        </dl>
      </div>

      {terminal.filterOpen ? (
        <div className="terminal-panel filter-editor">
          <div className="panel-title"><span>FILTER EDITOR</span><small>[ESC] CLOSE</small></div>
          <div className="filter-grid">
            <label className="filter-search">
              <span>/ ADDRESS OR NAME</span>
              <input
                id="list-search"
                type="search"
                value={data.filters.query}
                onChange={(event) => data.setQuery(event.target.value)}
                placeholder="0x…"
              />
            </label>
            <label>
              <span>LINK STATE</span>
              <select value={data.filters.link} onChange={(event) => data.setLinkFilter(event.target.value as ListFilters["link"])}>
                <option value="selected">SELECTED VERSION</option>
                <option value="all">ALL</option>
                <option value="linked">LINKED</option>
                <option value="unlinked">CLEAN</option>
                <option value="retained">RETAINED + REVIEW</option>
              </select>
            </label>
            <label>
              <span>EVIDENCE</span>
              <select value={data.filters.evidence} onChange={(event) => data.setEvidenceFilter(event.target.value as ListFilters["evidence"])}>
                <option value="all">ALL</option>
                <option value="high">MULTI-FAMILY</option>
                <option value="low">TWO-FAMILY</option>
              </select>
            </label>
          </div>
          <div className="preset-row" aria-label="MaxPane presets">
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.key}
                className={data.filters.preset === preset.value ? "is-active" : ""}
                onClick={() => terminal.applyPreset(preset.key)}
              >
                <kbd>{preset.key}</kbd><strong>{preset.label}</strong><span>{preset.detail}</span>
              </button>
            ))}
            <button type="button" onClick={() => data.setPreset("none")}>
              <kbd>0</kbd><strong>Preset off</strong><span>keep other filters</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className={`terminal-panel list-terminal${data.loading.list ? " is-loading" : ""}`}>
        <div className="panel-title">
          <span>CURATORWHITELIST :: {terminal.listView.toUpperCase()}</span>
          <small>[J/K] MOVE · [ENTER] INSPECT · [PGUP/PGDN] PAGE</small>
        </div>
        <div className="terminal-table-wrap">
          <table className="terminal-table">
            <thead>
              <tr>
                <th aria-hidden="true">&gt;</th>
                <th>RANK</th>
                <th>WALLET</th>
                <th>STATE</th>
                <th>POINTS</th>
                <th>CREDIT</th>
                <th>FIRST</th>
                <th><span className="sr-only">Inspect</span></th>
              </tr>
            </thead>
            <tbody>
              {page?.rows.map((row, index) => (
                <tr
                  key={row.address}
                  className={terminal.cursor === index ? "is-selected" : ""}
                  aria-selected={terminal.cursor === index}
                  onClick={() => terminal.setCursor(index)}
                  onDoubleClick={() => void terminal.inspect(row)}
                >
                  <td aria-hidden="true">{terminal.cursor === index ? "▶" : "·"}</td>
                  <td>#{formatCount(row.rank)}</td>
                  <td><AddressLink address={row.address} name={row.name} compact /></td>
                  <td><span className={`terminal-tag terminal-tag--${row.evidence_band ?? "none"}`}>{bandLabel(row.evidence_band ?? "none")}</span></td>
                  <td>{formatCount(row.points)}</td>
                  <td>{formatEth(row.credit_eth, overview.analysis.eth_usd)}</td>
                  <td>H{row.first_hour} / #{formatCount(row.first_index)}</td>
                  <td><button type="button" className="row-action" onClick={() => void terminal.inspect(row)}>OPEN</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.loading.list && page?.rows.length === 0 ? <p className="terminal-empty">NO MATCHING WALLETS</p> : null}
        </div>
        <div className="table-status">
          <span>{page === null || page.total === 0 ? "0" : `${formatCount(page.offset + 1)}–${formatCount(end)}`} / {page === null ? "0" : formatCount(page.total)}</span>
          <div>
            <button type="button" onClick={data.previousPage} disabled={page === null || page.offset === 0}>[PGUP] PREV</button>
            <button type="button" onClick={data.nextPage} disabled={page === null || end >= page.total}>[PGDN] NEXT</button>
          </div>
        </div>
      </div>
    </section>
  );
}
