import type {
  AnalysisVersion,
  ListFilters,
  ListPage,
  Overview,
} from "../models/domain";
import {
  formatCount,
  formatEthAmount,
} from "../models/presentation";
import { AddressLink } from "./AddressLink";

interface ListLeaderboardPageProps {
  readonly page: ListPage | null;
  readonly filters: ListFilters;
  readonly overview: Overview;
  readonly version: AnalysisVersion | null;
  readonly loading: boolean;
  readonly onQuery: (query: string) => void;
  readonly onPreset: (preset: ListFilters["preset"]) => void;
  readonly onSort: (sort: ListFilters["sort"]) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onExport: () => void;
  readonly onOpenWallet: (address: string) => void;
}

interface SortHeaderProps {
  readonly column: ListFilters["sort"];
  readonly label: string;
  readonly filters: ListFilters;
  readonly onSort: (sort: ListFilters["sort"]) => void;
}

function SortHeader({ column, label, filters, onSort }: SortHeaderProps) {
  const active = filters.sort === column;
  const direction = active ? filters.direction : null;
  const marker = direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";
  const state = direction === null ? "not sorted" : `sorted ${direction === "asc" ? "ascending" : "descending"}`;

  return (
    <th scope="col" aria-sort={direction === null ? undefined : direction === "asc" ? "ascending" : "descending"}>
      <button
        type="button"
        className={active ? "list-leaderboard__sort list-leaderboard__sort--active" : "list-leaderboard__sort"}
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}; ${state}`}
      >
        <span>{label}</span>
        <span aria-hidden="true">{marker}</span>
      </button>
    </th>
  );
}

function pageRange(page: ListPage | null): { start: number; end: number } {
  if (page === null || page.total === 0) return { start: 0, end: 0 };
  return {
    start: page.offset + 1,
    end: Math.min(page.offset + page.rows.length, page.total),
  };
}

function listTitle(version: AnalysisVersion | null): string {
  if (version?.list_scope === "raw") return "THE LIST (RAW)";
  if ((version?.status_counts.review ?? 0) > 0) {
    return "THE LIST (RETAINED + UNDER REVIEW)";
  }
  return "THE LIST (RETAINED)";
}

export function ListLeaderboardPage({
  page,
  filters,
  overview,
  version,
  loading,
  onQuery,
  onPreset,
  onSort,
  onPreviousPage,
  onNextPage,
  onExport,
  onOpenWallet,
}: ListLeaderboardPageProps) {
  const range = pageRange(page);
  const isDefaultList = filters.preset === "none";
  const isRawList = version?.list_scope === "raw";
  const defaultListLabel = isRawList ? "RAW LIST" : "CLEAN LIST";
  const presetLabels: Readonly<Record<ListFilters["preset"], string>> = {
    none: defaultListLabel,
    first1000: "FIRST 1,000 ENTRIES",
    hour0: "HOUR ZERO",
    whale: "25+ ETH DEPOSIT",
    ens: "ENS NAME SET",
  };
  const atFirstPage = page === null || page.offset === 0;
  const atLastPage = page === null || range.end >= page.total;
  const activeListCount = isDefaultList
    ? isRawList
      ? overview.totals.population
      : overview.totals.status_counts.clean + overview.totals.status_counts.review
    : page?.total ?? 0;

  return (
    <section className="list-leaderboard" aria-labelledby="list-leaderboard-title">
      <header className="list-leaderboard__header">
        <div>
          <span>THE LIST / WALLET ATTRIBUTE LEDGER</span>
          <h2 id="list-leaderboard-title">{listTitle(version)}</h2>
          {isRawList ? (
            <p>
              RAW LIST contains every wallet in the frozen WhitelistCurator snapshot before
              SybilKit filtering. Every preset narrows this same original population.
            </p>
          ) : (
            <p>
              CLEAN LIST is the selected analysis&apos;s retained output
              {(version?.status_counts.review ?? 0) > 0 ? ": clean wallets plus wallets kept under review" : ""}.
              Flagged wallets are excluded, and every preset narrows this same retained population.
            </p>
          )}
        </div>
        <dl className="list-leaderboard__docket">
          <div><dt>ACTIVE RULE SET</dt><dd>{version?.label ?? page?.version ?? "Loading…"}</dd></div>
          <div><dt>ACTIVE VIEW</dt><dd>{presetLabels[filters.preset]}</dd></div>
          <div><dt>ORIGINAL SNAPSHOT</dt><dd>{formatCount(overview.totals.population)} wallets</dd></div>
          <div><dt>{isRawList ? "RAW / FILTERED" : "CLEAN / FILTERED"}</dt><dd>{formatCount(activeListCount)} wallets</dd></div>
        </dl>
      </header>

      <div className="list-leaderboard__controls" aria-label="Leaderboard filters">
        <label className="list-leaderboard__search">
          <span>SEARCH ADDRESS OR NAME</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="0x… or ENS name"
          />
        </label>
        <label>
          <span>ENTRY PRESET</span>
          <select value={filters.preset} onChange={(event) => onPreset(event.target.value as ListFilters["preset"])}>
            <option value="none">{defaultListLabel}</option>
            {isRawList ? <option value="first1000">FIRST 1,000 ENTRIES</option> : null}
            <option value="hour0">HOUR ZERO</option>
            <option value="whale">25+ ETH DEPOSIT</option>
            <option value="ens">ENS NAME SET</option>
          </select>
        </label>
        <button type="button" onClick={onExport}>EXPORT CURRENT VIEW ↓</button>
      </div>

      <div className="list-leaderboard__ledger" aria-busy={loading}>
        <div className="list-leaderboard__table-wrap">
          <table>
            <caption className="visually-hidden">
              Wallet leaderboard for {version?.label ?? page?.version ?? "the selected analysis"}
            </caption>
            <thead>
              <tr>
                <SortHeader column="rank" label={`${isDefaultList ? isRawList ? "Raw" : "Clean" : "Filter"} / original rank`} filters={filters} onSort={onSort} />
                <SortHeader column="wallet" label="Wallet" filters={filters} onSort={onSort} />
                <SortHeader column="points" label="Points" filters={filters} onSort={onSort} />
                <SortHeader column="credit" label="Credit" filters={filters} onSort={onSort} />
                <SortHeader column="weight" label="Weight" filters={filters} onSort={onSort} />
                <SortHeader column="deposits" label="Deposits" filters={filters} onSort={onSort} />
                <SortHeader column="gross" label="Gross deposited" filters={filters} onSort={onSort} />
                <SortHeader column="range" label="Deposit range" filters={filters} onSort={onSort} />
                <SortHeader column="window" label="Hour window" filters={filters} onSort={onSort} />
                <th scope="col"><span className="visually-hidden">Open wallet profile</span></th>
              </tr>
            </thead>
            <tbody>
              {page?.rows.map((row) => (
                <tr key={row.address}>
                  <td className="list-leaderboard__rank">
                    <strong>#{formatCount(row.filter_rank)}</strong>
                    <small>ORIGINAL #{formatCount(row.rank)}</small>
                  </td>
                  <td className="list-leaderboard__wallet">
                    <div className="list-leaderboard__wallet-line">
                      <AddressLink address={row.address} compact />
                      {row.name ? <strong className="list-leaderboard__ens">{row.name}</strong> : null}
                    </div>
                  </td>
                  <td className="list-leaderboard__number">{formatCount(row.points)}</td>
                  <td>{formatEthAmount(row.credit_eth)}</td>
                  <td>{formatEthAmount(row.weight_eth)}</td>
                  <td className="list-leaderboard__number">{formatCount(row.deposit_count)}</td>
                  <td>{formatEthAmount(row.deposit_total_eth)}</td>
                  <td>
                    <strong>{formatEthAmount(row.min_deposit_eth)}</strong>
                    <small>TO {formatEthAmount(row.max_deposit_eth)}</small>
                  </td>
                  <td>
                    <strong>{row.first_hour === row.last_hour ? `HOUR ${row.first_hour}` : `HOURS ${row.first_hour}–${row.last_hour}`}</strong>
                    <small>ENTRY INDEX #{formatCount(row.first_index)}</small>
                  </td>
                  <td><button type="button" onClick={() => onOpenWallet(row.address)}>PROFILE</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && page?.rows.length === 0 ? (
            <p className="list-leaderboard__empty">NO WALLETS MATCH THESE FILTERS</p>
          ) : null}
          {loading && page === null ? (
            <p className="list-leaderboard__empty">LOADING WALLET LEDGER…</p>
          ) : null}
        </div>

        <footer className="list-leaderboard__paging">
          <p>
            <strong>{formatCount(range.start)}–{formatCount(range.end)}</strong>
            <span>OF {formatCount(page?.total ?? 0)} MATCHED WALLETS</span>
          </p>
          <div>
            <button type="button" onClick={onPreviousPage} disabled={atFirstPage}>← PREVIOUS 50</button>
            <button type="button" onClick={onNextPage} disabled={atLastPage}>NEXT 50 →</button>
          </div>
        </footer>
      </div>

      <p className="list-leaderboard__note">
        {isRawList
          ? "RAW LIST is the original 19,522-wallet contract population."
          : "CLEAN LIST contains every wallet retained by the selected analysis."} Presets,
        search, and sorting stay inside that selected population. Rank belongs to the selected
        population and is not rewritten by search or sorting; deposit amounts and hour windows
        come from the frozen contract events.
      </p>
    </section>
  );
}
