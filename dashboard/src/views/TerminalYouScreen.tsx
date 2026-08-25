import type { ClusterMapController } from "../controllers/useClusterMapController";
import type { TerminalController } from "../controllers/useTerminalController";
import type { Overview } from "../models/domain";
import { clusterLabel, familyLabel, formatCount, formatEth, formatPercent } from "../models/presentation";
import { AddressLink } from "./AddressLink";

interface YouScreenProps {
  readonly data: ClusterMapController;
  readonly terminal: TerminalController;
  readonly overview: Overview;
}

export function YouScreen({ data, terminal, overview }: YouScreenProps) {
  const detail = data.wallet;
  if (detail === null) {
    return (
      <section className="wallet-empty">
        <span>&gt; YOU</span>
        <h1>NO WALLET SELECTED</h1>
        <p>PRESS [W] OR CHOOSE A ROW IN THE LIST AND PRESS [ENTER].</p>
        <button type="button" onClick={terminal.openWalletPrompt}>[W] CHOOSE WALLET</button>
      </section>
    );
  }

  return (
    <section className="screen-stack" aria-labelledby="you-screen-title">
      <div className="terminal-hero wallet-hero">
        <div>
          <span>THE LIST / YOU / {detail.status.toUpperCase()}</span>
          <h1 id="you-screen-title">RANK #{formatCount(detail.wallet.rank)}</h1>
          <AddressLink address={detail.wallet.address} name={detail.wallet.name} />
        </div>
        <dl>
          <div><dt>POINTS</dt><dd>{formatCount(detail.wallet.points)}</dd></div>
          <div><dt>CREDIT</dt><dd>{formatEth(detail.wallet.credit_eth, detail.eth_usd)}</dd></div>
          <div><dt>TX COUNT</dt><dd>{formatCount(detail.wallet.tx_count)}</dd></div>
          <div><dt>JOIN</dt><dd>H{detail.wallet.first_hour} / #{formatCount(detail.wallet.first_index)}</dd></div>
        </dl>
      </div>

      <div className="you-layout">
        <div className="terminal-panel wallet-ladder">
          <div className="panel-title"><span>EVIDENCE LADDER</span><small>{detail.related_edges.length} DISPLAYED LINKS</small></div>
          {detail.related_edges.length === 0 ? (
            <p className="terminal-empty">NO DIRECT DISPLAYED EDGE FOR THIS WALLET</p>
          ) : (
            <div className="edge-ledger">
              {detail.related_edges.map((edge, index) => {
                const other = edge.source === detail.wallet.address ? edge.target : edge.source;
                return (
                  <div key={`${edge.family}-${edge.source}-${edge.target}-${index}`}>
                    <span className={`family-mark family-mark--${edge.family}`} />
                    <span>{familyLabel(edge.family).toUpperCase()}</span>
                    <AddressLink address={other} compact />
                    <small>{edge.is_transfer ? "TRANSFER" : `${Math.round(edge.strength * 100)}% SIGNAL`}</small>
                    <button type="button" onClick={() => void terminal.submitWallet(other)}>OPEN</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="terminal-panel wallet-facts">
          <div className="panel-title"><span>WALLET FACTS</span><small>READ-ONLY</small></div>
          <dl className="fact-grid">
            <div><dt>STATUS</dt><dd>{detail.status === "linked" ? "LINKED GROUP" : "NO GROUP LINK"}</dd></div>
            <div><dt>WEIGHT</dt><dd>{formatEth(detail.wallet.weight_eth, overview.analysis.eth_usd)}</dd></div>
            <div><dt>FIRST FUNDER</dt><dd>{detail.first_funder === null ? "NOT MEASURED" : <AddressLink address={detail.first_funder} compact />}</dd></div>
            <div><dt>GROUP</dt><dd>{detail.cluster === null ? "—" : `${clusterLabel(detail.cluster.id)} · ${detail.version}`}</dd></div>
            <div><dt>CONFIDENCE</dt><dd>{detail.cluster === null ? "—" : formatPercent(detail.cluster.confidence)}</dd></div>
          </dl>
          {detail.cluster === null ? (
            <p className="terminal-copy">NO SYBILKIT GROUP SATISFIED THE CONFIGURED MULTI-FAMILY THRESHOLD. THIS IS NOT A CLAIM OF INDEPENDENCE.</p>
          ) : (
            <>
              <div className="reason-list wallet-reasons">
                {detail.cluster.reasons.map((reason) => <div key={`${reason.family}-${reason.text}`}><span className={`family-mark family-mark--${reason.family}`} /><p><strong>{familyLabel(reason.family)}</strong><span>{reason.text}</span></p></div>)}
              </div>
              <button
                type="button"
                className="terminal-primary"
                onClick={() => void data.openCluster(detail.cluster!.id).then(() => terminal.navigate("history"))}
              >
                [H] OPEN {clusterLabel(detail.cluster.id)} · {detail.version} MAP
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
