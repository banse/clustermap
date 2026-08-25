import type { AnalysisMeta } from "../models/domain";

export function MapIntroduction({ analysis }: { readonly analysis: AnalysisMeta | null }) {
  const minimumSize = analysis?.min_size ?? 5;
  const minimumFamilies = analysis?.min_families ?? 2;

  return (
    <section className="map-introduction" aria-label="What this map shows">
      <p>
        <strong>ORIGIN // THE LIST — &quot;I was here.&quot;</strong>
        <span>A zero-custody Ethereum allowlist game: escalating ETH sends were refunded in the same transaction, while a square-root curve awarded points until an hourly threshold closed entry.</span>
      </p>
      <p>
        <strong>FILTER // SYBILKIT — &quot;I count.&quot;</strong>
        <span>This map preserves the frozen CuratorWhitelist. Groups require {minimumSize}+ wallets and {minimumFamilies}+ independent evidence families: funding, amount, sequence, cadence or gas.</span>
      </p>
      <p>
        <strong>READ // EVIDENCE</strong>
        <span>Open a group, then a wallet, to inspect its links. Patterns support review; they do not prove common ownership.</span>
      </p>
    </section>
  );
}
