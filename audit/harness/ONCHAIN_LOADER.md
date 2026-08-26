# sk_v2_onchain — reconstruct THE LIST from the contract, not from a file

**Designed 2026-08-27, not yet built.** Feasibility verified against
`contracts/allowlist/abi.json` and `curator_snapshot.json.gz`; every claim below was checked, not
assumed.

## Why

Today a third party reproduces the clusters by cloning
`github.com/banse/clustermap` and trusting `data/curator_snapshot.json.gz`. That file is honest and
pinned, but it is still *our* file. This replaces "trust the snapshot" with **"check it against the
chain"**: point the harness at any Ethereum node and it rebuilds the population from the contract's own
event log.

`sk_v2.py` needs **no changes**. This is a second front end beside `sk_diag.load()`, producing the same
`Dataset` the rules already consume.

## Inputs

| | |
|---|---|
| RPC | any Ethereum node (`--rpc`, else `AID_ETH_RPC_URL`). No archive node required — these are logs and receipts, not historical state |
| contract | `0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91` (mainnet) |
| range | deployment `25,769,870` → snapshot `25,807,057` = **37,187 blocks** |
| scale | 28,353 deposits, 19,522 contributors — minutes, not hours |

## Event → field mapping (verified against the ABI)

Every field the snapshot carries is on the events. Nothing is derived or guessed.

```
Deposited(address indexed contributor, uint256 indexed hour, uint256 amount,
          uint256 creditedDelta, uint256 weightAdded, uint256 newWeight,
          uint256 txCount, uint256 hourTotal, uint256 earlyBps)
```
→ `contributor`, `hour`, `amount_wei`, `credited_delta_wei`, `weight_added_wei`, `new_weight_wei`,
`tx_count`, `hour_total_wei`, `early_bps`. `block_number` / `tx_hash` / `log_index` come from the log
envelope; `ts` from the block timestamp (or from `FirstDeposit`, which carries it directly).

**`hour` is an indexed topic**, so hour attribution needs no block-timestamp arithmetic — the contract
already decided it. That removes the one place a reconstruction could plausibly drift.

```
FirstDeposit(address indexed contributor, uint256 indexed index, uint256 timestamp)
```
→ `first_deposits` verbatim (`contributor`, `index`, `ts`).

```
HourSaved(address indexed savior, uint256 indexed hour, uint256 hourTotal)
```
→ the rescuer set the harness reads from `cache["hour_saved"]` (41 rows).

```
Settled(uint256 indexed hour, uint256 timestamp, uint256 totalContributors, uint256 totalVolume)
```
→ **a built-in self-check.** If the reconstruction does not total 19,522 contributors, it is wrong
before a single cluster is computed. Assert this first; it is the cheapest possible failure.

## What the chain can and cannot give

| input | source | trustless? |
|---|---|---|
| deposits, weights, credits, hours, tx counts | `Deposited` logs | **yes** |
| the contributor set and join order | `FirstDeposit` logs | **yes** |
| rescuers, settlement totals | `HourSaved`, `Settled` | **yes** |
| deposit tx fingerprints (nonce, fees, gas limit) | `eth_getTransactionByHash` × 28,353 | **yes**, any node |
| ENS names | on-chain reverse resolution | **yes**, any node |
| **first funder × 19,522** | each wallet's own history | **no** — see below |

**The honest boundary.** A wallet's first funder is a fact about *that wallet*, not about the whitelist,
so no amount of reading this contract produces it. It needs transaction history: an indexer, an archive
node, or the ~50-minute keyless Blockscout sweep `fetch_all_enrich.py` already implements. It also
happens to be the input the strongest rule runs on — the tight peel chain, which takes the ≈99 ETH ring
from 81/419 to 397/419.

So the trust surface does not vanish, it *shrinks and becomes checkable*: the list rebuilds itself from
the chain, and the enrichment is one file in which **every row is independently verifiable with a single
lookup**. Disputing one wallet's funder costs one query, not a re-audit.

## Acceptance criteria

The reconstruction is correct when, with no snapshot file present:

1. `Settled.totalContributors == 19,522` and the rebuilt `first_deposits` has 19,522 rows with matching
   indexes.
2. The rebuilt events equal the snapshot's 28,353 events **field for field** (this is the real test; run
   it once against the committed snapshot, then the snapshot becomes redundant rather than trusted).
3. Running the existing rules on the rebuilt `Dataset` reproduces, exactly:

| run | expected |
|---|---|
| `baseline(shipped)` | 263 clusters, 11,573 flagged, 57.6 % of points |
| `v2h` | 160 clusters, 12,416 core, 324 periphery, 76.7 % of points |
| v2h cluster-membership hash | `bd986908e33bf6c1c4cda481dae0009f` |
| v2h flagged-set hash | `71e561a2d104bea9f0e36e742ec54ddc` |

Those two hashes are the point of the exercise: `sha256` over the sorted cluster tuples and over the
sorted flagged set, verified stable across processes on 2026-08-27. A stranger who rebuilds from the
chain and gets those digits has verified the published clustering without trusting anything of ours.

## Implementation notes

- Chunked `eth_getLogs` with a watermark — the pattern is already in `bin/aid` and the rules are written
  up in `docs/knowledge.md` (chunk size, reorg margin, provider caps). 37 k blocks is a handful of calls.
- `topic0` per event = keccak of the canonical signature; `contributor` and `hour` are indexed, so most
  filtering is free.
- Batch `eth_getTransactionByHash` 100 per request — `fetch_all_enrich.py` already does this and did all
  28,353 in about a minute.
- Public nodes that answered batched requests: `ethereum-rpc.publicnode.com`, `rpc.mevblocker.io`,
  `eth.merkle.io`. All three rate-limit; rotate with a cooldown and **never accept a partial batch** — a
  dropped batch looks exactly like a set of addresses that do not exist.
- Keep the funding loader pluggable: `--funding <file>` (the committed enrichment, default) or
  `--funding-fetch` (the Blockscout sweep). Never silently mix.

## Effort

About a day. The mapping is one-to-one, the scale is small, and the acceptance test is a hash comparison
rather than a judgement call.
