# Control standard — what counts as a verifiably honest wallet on THE LIST

**Pre-registered 2026-08-25, before the criteria were applied to any wallet.** The point of writing it
first is that a control set chosen after seeing which wallets the detector clears measures nothing: it
would encode the detector's opinion and hand it back as precision. Every criterion below is a property
of the wallet itself. **None of them refers, directly or indirectly, to any detector output** — not to
cluster membership, not to confidence, not to a flag, not to sybilkit at all.

## Why this exists

The benchmark shipped with sybilkit scores 220 labelled wallets in isolation and reports precision 1.0.
Both halves are hollow. Scoring in isolation means a control can never be pulled into a cluster by the
other 19,300 wallets, which is the only way false positives actually happen here. And the 60 "controls"
were sampled as *non-audited* wallets — not as *verified honest* ones — so several are jitter-batch or
ring members. A detector cannot be measured against controls that are themselves farm wallets.

## What "verifiably honest" can and cannot mean

It cannot mean proof. Nothing in public chain data proves one human controls one wallet, and a patient
operator can imitate every criterion below. What it can mean is: **the wallet carries costly, durable
evidence of an independent life that a wallet farmed for this game would have no reason to carry.**
The standard is deliberately strict and will admit a small set. A small honest set is useful; a large
uncertain one is not.

## The criteria — all must hold

**C1 — Aged.** The deposit was sent at nonce ≥ 50: the wallet had already sent at least fifty
transactions before this game existed. (57.9% of this population deposited at nonce 0.)

**C2 — Independently funded.** The wallet's first funder is not another contributor on THE LIST, and is
not a small operator hub. Its money entered from outside the game's own population.

**C3 — Named.** The wallet has an ENS reverse record. A name costs money and ties the address to a
persistent identity across applications; farms do not name their wallets (measured: the undisputed
farms name 0.05% of theirs).

**C4 — Not a one-shot vehicle.** The wallet's funder funded no other contributor on the list. A funder
fanning out to several list wallets is the shape of an operator, whatever its owner intends.

**C6 — Funded no one on the list.** The wallet did not fund another contributor. *(Added by amendment,
see below.)*

**C5 — Survived the game.** After the game settled, the wallet did not sweep its balance to a
collector. Concretely: no outgoing transfer, in the 7 days after settlement, moving ≥ 90% of its
balance to an address that also received from another contributor.

## How it is validated

The criteria are applied **blind to the whole population**, then checked against the independent
2026-08-17 farm audit, which was produced before any of this work and never used sybilkit's output:

- if the standard admits members of the audited farm waves, the standard is wrong and must be
  tightened before any measurement is taken from it;
- the number admitted is reported whether it is convenient or not.

## How the result is used

Controls are scored **in situ** — inside a run over the whole 19,522-wallet population, never in
isolation. A control that the detector links is a false positive, full stop. Precision and recall are
reported with the control count beside them, so a small denominator is visible rather than hidden in a
percentage.

If the standard yields too few wallets to measure against, that is the finding, and the correct
conclusion is that no precision claim can be made on this population — not that the standard should be
loosened until a number appears.

## Amendment, 2026-08-25 — C6

The first application of C1–C5 admitted **lixy3.eth**, which v2g flagged. On inspection v2g was right
and this standard was wrong: lixy3 funded lixy4, which funded lixy5, and a fourth sibling lixy10 was
funded by moreairdrop.eth. All four deposited in hour 35 at nonce 150–223 and ran the identical
0.05 / 0.15 / 0.25 / 0.35 ladder. lixy3 passed every criterion because it sits at the *head* of the
chain: its own funder is outside the population and funded nobody else, so C2 and C4 both held.

C1–C4 asked only where a wallet's money came from. They never asked where it went. An operator's first
wallet is indistinguishable from a person's under that omission — which is precisely the wallet an
operator would use to hold a name.

**C6** closes it, symmetrically to C4 and still using no detector output: a control must not have funded
another contributor. Recorded as an amendment rather than a silent edit, because a standard that is
quietly rewritten after seeing results is not a standard. Both the pre-amendment and post-amendment
figures are reported.

## Second validation note, 2026-08-25 — the standard's ceiling, demonstrated

After the C6 amendment one control remained flagged by the tightened rule set: **optimisticsandwich.eth**
(nonce 1,931, ENS-named, independently funded, funded no one, no post-game sweep — it satisfies every
criterion here). It is not a false positive. It deposited 0.05 then 2.067 ETH inside the audited 2.067
ETH wave, and that wave is **324 wallets carrying one identical priority fee of 1,000,000 wei, none of
them at nonce 0**. It shares that fee and an unusual 696,769 gas limit. Two of the 324 are named.

The operator aged and named its wallets. Every criterion above is satisfied by doing so, and this is the
ceiling the opening section claims but could not yet demonstrate: **the standard identifies wallets that
carry a costly independent history, not wallets that are certainly one human's.** An operator prepared to
buy names and warm wallets for months passes it.

Two consequences, both worth stating rather than hiding:

1. The residual false-positive rate measured against these controls is a **ceiling, not a point estimate** —
   the true rate is at most what is reported and probably lower, because some flagged "controls" are, like
   this one, correctly flagged.
2. The audited farm windows are defined over *single-deposit* wallets, so a two-deposit member of the same
   wave is outside them. That is a limitation of the window definition, not of the detector: this wallet is
   in the wave on amount, timing and fee fingerprint.
