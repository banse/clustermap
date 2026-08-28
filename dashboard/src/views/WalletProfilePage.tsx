import type { WalletDetail } from "../models/domain";
import { clusterLabel, familyLabel, formatCount, formatEth, formatPercent, walletGroupLabel } from "../models/presentation";
import type { WalletProfileStatus } from "../models/walletProfile";
import { AddressLink } from "./AddressLink";
import { WalletReviewEvidence } from "./ReviewWalletDetail";
import { WalletVersionHistory } from "./WalletVersionHistory";

interface WalletProfilePageProps {
  readonly address: string | null;
  readonly detail: WalletDetail | null;
  readonly status: WalletProfileStatus;
  readonly draft: string;
  readonly draftError: string | null;
  readonly snapshotBlock: number;
  readonly disclaimer: string;
  readonly dispute?: { readonly text: string; readonly audit_url: string; readonly contest_url: string };
  readonly onDraftChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onClear: () => void;
  readonly onShowOnMap: () => void;
}

function clusterState(detail: WalletDetail): string {
  // The wallet's OWN tier, not its cluster's: a member held by a single
  // evidence family is shown for review whatever its group scored.
  if (detail.cluster === null) return walletGroupLabel(null).toUpperCase();
  return walletGroupLabel(detail.member_risk).toUpperCase();
}

export function WalletProfilePage({
  address,
  detail,
  status,
  draft,
  draftError,
  snapshotBlock,
  disclaimer,
  onDraftChange,
  onSave,
  onClear,
  onShowOnMap,
  dispute,
}: WalletProfilePageProps) {
  return (
    <section className="wallet-profile" aria-labelledby="wallet-profile-title">
      <header className="wallet-profile__header">
        <div>
          <span>LOCAL REFERENCE · NO CONNECTION</span>
          <h2 id="wallet-profile-title">YOUR WALLET PROFILE</h2>
          <p>Set one public address to keep it marked while you inspect THE LIST and its SybilKit evidence.</p>
        </div>
        <strong>NO SIGNER<br />NO BROADCAST</strong>
      </header>

      <form
        className="wallet-address-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label htmlFor="focus-wallet-address">ETHEREUM ADDRESS</label>
        <div>
          <input
            id="focus-wallet-address"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={draftError !== null}
            aria-describedby="focus-wallet-note"
            placeholder="0x0000000000000000000000000000000000000000"
            value={draft}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
          />
          <button type="submit">{address === null ? "SET WALLET" : "UPDATE WALLET"}</button>
        </div>
        <p id="focus-wallet-note">Stored only in this browser. Enter a 42-character Ethereum hex address; no wallet permission or signature is requested.</p>
        {draftError === null ? null : <strong className="wallet-address-form__error" role="alert">{draftError}</strong>}
      </form>

      {status === "loading" ? (
        <div className="wallet-profile__state" aria-live="polite">
          <span className="wallet-profile__loader" aria-hidden="true" />
          <div><strong>READING SNAPSHOT PROFILE</strong><p>Checking THE LIST and SybilKit result at block {formatCount(snapshotBlock)}.</p></div>
        </div>
      ) : status === "not-listed" && address !== null ? (
        <div className="wallet-profile__state wallet-profile__state--empty">
          <span>OUTSIDE SNAPSHOT</span>
          <h3>NOT IN THE ORIGINAL LIST</h3>
          <AddressLink address={address} />
          <p>This valid address does not appear in the frozen THE LIST population at block {formatCount(snapshotBlock)}. It has no wallet node, rank, points, or SybilKit group in this dataset.</p>
          <button type="button" onClick={onClear}>CLEAR WALLET</button>
        </div>
      ) : status === "error" && address !== null ? (
        <div className="wallet-profile__state wallet-profile__state--empty">
          <span>PROFILE UNAVAILABLE</span>
          <h3>DATA COULD NOT BE READ</h3>
          <AddressLink address={address} />
          <p>Use Update wallet to retry this address after the data request is available.</p>
        </div>
      ) : status === "listed" && detail !== null ? (
        <div className="wallet-profile__result">
          <header className="wallet-profile__identity">
            <div>
              <span>IN THE LIST · RANK #{formatCount(detail.wallet.rank)}</span>
              <AddressLink address={detail.wallet.address} name={detail.wallet.name} />
            </div>
            <div className="wallet-profile__actions">
              <button type="button" onClick={onShowOnMap}>SHOW ON MAP</button>
              <button type="button" onClick={onClear}>CLEAR WALLET</button>
            </div>
          </header>

          <div className="wallet-profile__metrics" aria-label="Original list metrics">
            <div><span>LIST RANK</span><strong>#{formatCount(detail.wallet.rank)}</strong></div>
            <div><span>POINTS</span><strong>{formatCount(detail.wallet.points)}</strong></div>
            <div><span>TRANSACTIONS</span><strong>{formatCount(detail.wallet.tx_count)}</strong></div>
            <div><span>FIRST SEEN</span><strong>HOUR {detail.wallet.first_hour} · #{formatCount(detail.wallet.first_index)}</strong></div>
          </div>

          <div className="wallet-profile__grid">
            <article>
              <span className="wallet-profile__eyebrow">LIST STATE</span>
              <h3>ORIGINAL ALLOWLIST RECORD</h3>
              <dl className="wallet-profile__facts">
                <div><dt>Membership</dt><dd>In THE LIST snapshot</dd></div>
                <div><dt>Credit</dt><dd>{formatEth(detail.wallet.credit_eth, detail.eth_usd)}</dd></div>
                <div><dt>Weight</dt><dd>{formatEth(detail.wallet.weight_eth, detail.eth_usd)}</dd></div>
                <div><dt>Snapshot</dt><dd>Block {formatCount(snapshotBlock)}</dd></div>
                <div><dt>First funder</dt><dd>{detail.first_funder === null ? "Not measured" : <AddressLink address={detail.first_funder} compact />}</dd></div>
              </dl>
            </article>

            <article>
              <span className="wallet-profile__eyebrow">CLUSTERING STATE</span>
              <div className={`wallet-profile__cluster-state wallet-profile__cluster-state--${detail.cluster === null ? "independent" : detail.member_risk}`}>
                <strong>{clusterState(detail)}</strong>
                <span>{detail.cluster === null ? `No SybilKit group in ${detail.version}` : `${clusterLabel(detail.cluster.id)} · ${detail.version} · ${formatPercent(detail.cluster.confidence)} confidence`}</span>
              </div>

              {detail.cluster === null ? (
                <p className="wallet-profile__independent">This wallet remains in the original list but is not part of any kept 5+ wallet, 2+ evidence-family group. It is marked only in the global wallet field.</p>
              ) : (
                <>
                  <div className="wallet-profile__cluster-facts">
                    <div><span>GROUP</span><strong>{clusterLabel(detail.cluster.id)} · {detail.version}</strong></div>
                    <div><span>GROUP SIZE</span><strong>{formatCount(detail.cluster.size)} WALLETS</strong></div>
                    <div><span>DIRECT LINKS</span><strong>{formatCount(detail.related_edges.length)}</strong></div>
                  </div>
                  <h4>EVIDENCE ON THIS WALLET</h4>
                  {detail.member_families.length === 0 ? (
                    <p className="detail-note">
                      No evidence family touches this wallet directly; it is in the group through
                      other members.
                    </p>
                  ) : (
                    <div className="inspection-family-strip">
                      {detail.member_families.map((family) => <span key={family}><i className={`family-mark family-mark--${family}`} />{familyLabel(family)}</span>)}
                    </div>
                  )}
                  {detail.member_families.length < 2 && (
                    <p className="detail-note">
                      Fewer than two families hold this wallet, so it is shown for review rather
                      than at its group&rsquo;s tier. The reasons below describe the GROUP and may
                      not apply to this wallet.
                    </p>
                  )}
                  <h4>WHY THIS GROUP EXISTS</h4>
                  <div className="inspection-family-strip">
                    {detail.cluster.families.map((family) => <span key={family}><i className={`family-mark family-mark--${family}`} />{familyLabel(family)}</span>)}
                  </div>
                  <div className="detail-reasons">
                    {detail.cluster.reasons.map((reason) => (
                      <div key={`${reason.family}-${reason.text}`}>
                        <span className={`family-mark family-mark--${reason.family}`} />
                        <p><strong>{familyLabel(reason.family)}</strong><span>{reason.text}</span></p>
                        <b>{formatPercent(reason.strength)}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>
          </div>
          <WalletReviewEvidence detail={detail} />
          <WalletVersionHistory history={detail.history} selectedVersion={detail.version} />
          <p className="wallet-profile__disclaimer">{disclaimer}</p>
          {dispute ? (
            <p className="wallet-profile__dispute">
              {dispute.text}{" "}
              <a href={dispute.audit_url} target="_blank" rel="noreferrer">How this was measured</a>
              {" · "}
              <a href={dispute.contest_url} target="_blank" rel="noreferrer">Contest this classification</a>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="wallet-profile__state wallet-profile__state--empty">
          <span>NO WALLET SET</span>
          <h3>TYPE AN ADDRESS TO BEGIN</h3>
          <p>The profile will show its original-list record and any kept SybilKit group. If it appears in a graph, a persistent YOU reticle will mark it.</p>
        </div>
      )}
    </section>
  );
}
