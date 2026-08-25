import type { Overview } from "../models/domain";
import { formatCount } from "../models/presentation";
import { AddressLink } from "./AddressLink";

interface WelcomePageProps {
  readonly overview: Overview;
  readonly onOpenMap: () => void;
  readonly onOpenProfile: () => void;
}

const noticeIntroduction = [
  "@title WhitelistCurator",
  "@notice Curates a permissionless onchain allowlist of proven wallets — usable as a whitelist for",
  "        mints and early access, as an airdrop distribution list, or as reputation input. You send",
  "        ETH, the same transaction sends it straight back — the contract never keeps a wei. What",
  "        persists is the record.",
  "",
  "        Because the list lives onchain, a gating contract can read it directly at mint time:",
  "        there is no merkle root to publish and no snapshot to maintain.",
] as const;

const builderNotice = [
  "─────────────────────────────────────────────────────────────────────────────────────────────",
  " FOR BUILDERS CONSUMING THIS LIST",
  "─────────────────────────────────────────────────────────────────────────────────────────────",
  "",
  " This contract does not pretend to solve sybil resistance, and you should not use it as if it",
  " did. Nothing onchain can, once the ETH is handed straight back: fanning out across a hundred",
  " wallets costs gas and nothing else, and the square-root curve actively rewards doing so.",
  " Filter that off-chain. The events carry what you need to cluster it — first-seen hour, the",
  " whole escalation ladder, tx counts, hour-by-hour timing — and a farm funded from one source",
  " in one afternoon does not look like a hundred strangers.",
  "",
  " What the contract DOES enforce is that the ETH was actually held. Only code-less EOAs may",
  " deposit, so no depositor can sit inside a flash-loan callback and compose borrow → deposit →",
  " refund → repay atomically. Every high-water mark on this list was real balance at the moment",
  " it was recorded. That is the one capital claim you can take at face value.",
  "",
  " What the list does give you is a signal that is expensive to fake and impossible to",
  " backfill: addresses that were still showing up on mainnet, paying real gas, hour after hour,",
  " in a quiet market after almost everyone else had left. Anyone can buy a token balance or",
  " farm a testnet. Nobody can retroactively have been here. That presence is the product; the",
  " points are just the scoreboard on top of it.",
  "",
  " Practical consequence for a sybil: the payoff is a bigger share of whatever the list is spent",
  " on — a whitelist allocation, an airdrop, a reputation score — and the downside is being",
  " clustered and dropped from it entirely. They are wagering gas against total exclusion, which",
  " is a deterrent that lives in your indexer, not in this contract.",
  "",
  "─────────────────────────────────────────────────────────────────────────────────────────────",
] as const;

function ContractExcerpt({ label, lines }: { readonly label: string; readonly lines: readonly string[] }) {
  return (
    <article className="contract-comment" aria-label={label}>
      <code>
        {lines.map((line, index) => (
          <span className={`contract-comment__line${line.startsWith("─") ? " contract-comment__line--rule" : ""}`} key={`${index}-${line}`}>
            <span aria-hidden="true">///</span>
            <span>{line || "\u00a0"}</span>
          </span>
        ))}
      </code>
    </article>
  );
}

export function WelcomePage({ overview, onOpenMap, onOpenProfile }: WelcomePageProps) {
  return (
    <section className="welcome-page" aria-labelledby="welcome-title">
      <header className="welcome-hero">
        <div className="welcome-hero__lead">
          <span className="welcome-eyebrow">WHY CLUSTERMAP EXISTS // THE LIST</span>
          <h2 id="welcome-title">PRESENCE WAS<br />THE PRODUCT.</h2>
          <p>
            WhitelistCurator made one fact durable: these wallets showed up on Ethereum,
            held the ETH they recorded, and paid real gas while the game was open.
            CLUSTERMAP shows how that record is reviewed before it is reused.
          </p>
          <div className="welcome-actions">
            <button type="button" onClick={onOpenMap}>OPEN THE MAP</button>
            <button type="button" onClick={onOpenProfile}>CHECK A WALLET</button>
          </div>
        </div>

        <div className="welcome-contract-excerpts" role="region" aria-label="WhitelistCurator contract excerpts">
          <ContractExcerpt label="WhitelistCurator title and notice" lines={noticeIntroduction} />
          <ContractExcerpt label="WhitelistCurator builder guidance" lines={builderNotice} />
        </div>
      </header>

      <section className="welcome-ledger" aria-label="Current analysis ledger">
        <div><span>WALLETS RECORDED</span><strong>{formatCount(overview.totals.population)}</strong></div>
        <div><span>REFUNDED DEPOSITS</span><strong>{formatCount(overview.totals.deposits)}</strong></div>
        <div><span>KEPT GROUPS</span><strong>{formatCount(overview.totals.groups)}</strong></div>
        <div>
          <span>KEPT-GROUP RULE</span>
          <strong>{overview.analysis.min_size}+ WALLETS / {overview.analysis.min_families}+ FAMILIES</strong>
        </div>
      </section>

      <div className="welcome-story">
        <article>
          <span className="welcome-story__index">01 // THE ORIGINAL RECORD</span>
          <h3>A REFUND THAT LEFT A TRACE.</h3>
          <p>
            WhitelistCurator was a permissionless onchain allowlist game. Every deposit
            returned in the same transaction, but each wallet&apos;s escalating high-water
            contribution remained onchain. After the grace period, one quiet clock hour
            settled the contract and froze the list forever.
          </p>
          <p>
            Only code-less EOAs could deposit. That makes each recorded high-water mark
            evidence of balance held at that moment—not evidence of one person behind one wallet.
          </p>
          <strong className="welcome-pullquote">
            Nobody can retroactively have been here.
          </strong>
        </article>

        <article>
          <span className="welcome-story__index">02 // WHY SYBILKIT WAS BUILT</span>
          <h3>THE FILTER LIVES IN THE INDEXER.</h3>
          <p>
            The contract deliberately did not claim Sybil resistance. Refunded capital
            made wallet fan-out cheap, while the square-root score rewarded splitting.
            Its event history therefore preserved the timing, amounts, sequence, gas,
            and funding patterns needed for offchain review.
          </p>
          <p>
            SybilKit was built for that gap. It keeps a group only when multiple wallets
            share multiple independent evidence families, then exposes the reasons and
            confidence behind the grouping for inspection.
          </p>
          <strong className="welcome-caveat">
            PATTERN EVIDENCE, NEVER AN IDENTITY VERDICT.
          </strong>
        </article>
      </div>

      <aside className="welcome-outlook" aria-labelledby="welcome-outlook-title">
        <div>
          <span>03 // POSSIBLE NEXT RECORD</span>
          <strong>OUTLOOK<br />NOT AN ANNOUNCEMENT</strong>
        </div>
        <div>
          <h3 id="welcome-outlook-title">A COLLECTIBLE RECORD FOR WHAT REMAINS.</h3>
          <p>
            One future direction under consideration is an NFT collection for
            WhitelistCurator participants whose wallets are not linked into a kept
            SybilKit group under the analysis used for that project.
          </p>
        </div>
        <p className="welcome-outlook__notice">
          No collection, mint, snapshot, or eligibility rule is announced here.
          Current unlinked status is an analytical state—not a promise and not proof
          of a unique human.
        </p>
      </aside>

      <div className="welcome-source">
        <span>SOURCE RECORD // ETHEREUM MAINNET</span>
        <AddressLink address={overview.provenance.contract} compact />
        <span>SNAPSHOT BLOCK {formatCount(overview.provenance.snapshot_block)}</span>
      </div>
    </section>
  );
}
