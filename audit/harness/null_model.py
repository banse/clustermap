#!/usr/bin/env python3
"""Null model: a synthetic population with NO operators, joining at the observed pace.

Amounts are drawn from the empirical first-deposit amounts of ENS-named single-deposit
wallets (the closest thing to a human amount prior in this dataset); join times follow the
observed per-hour joiner counts (two densities: observed, and "honest" = observed minus the
audited farm waves); blocks are drawn uniformly inside each hour's real block range; funders
are simulated (35% unique personal wallet, 40% one of 12 exchange hot wallets with a skewed
share, 25% unresolved); gas fingerprints follow the measured control diversity.

Then the shipped rules and the candidate rules are run on it.  Every wallet flagged here is
a false positive by construction.  Seeded; 5 repetitions each.
"""
from __future__ import annotations

import os

import collections
import json
import random
import statistics
import sys
from decimal import Decimal

sys.path.insert(0, "/Library/Vibes/autopull/sybilkit/src")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sybilkit import Dataset  # noqa: E402
from sybilkit.signals import deposit_counts, first_rows  # noqa: E402

import sk_v2  # noqa: E402
from sk_diag import load  # noqa: E402

def _resolve_data():
    """Evidence dir: `audit/data` in a clustermap checkout, `data/sybil` in the
    workspace this was written in. Override with env SYBIL_DATA."""
    here = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(here, "..", "data"), os.path.join(here, "..", "..", "data", "sybil")):
        if os.path.isdir(c):
            return c
    return os.path.join(here, "..", "..", "data", "sybil")


SCRATCH = os.environ.get("SYBIL_DATA") or _resolve_data()
ETH = 10**18


def main():
    cache, ds, preset, ens, live_groups = load()
    # Run the null at production coverage: with every contributor's funder
    # resolved, the funding family gets its full chance to link honest wallets,
    # and `coverage` below stops discounting that chance.
    if "--enrich-extra" in sys.argv:
        enr = cache["last_good"]["clusters"]["payload"]["enrichment"]
        txs, funding = dict(enr["txs"]), dict(enr["funding"])
        for path in sys.argv[sys.argv.index("--enrich-extra") + 1].split(";"):
            ex = json.load(open(path))
            for h, t in ex.get("txs", {}).items():
                txs.setdefault(h, t)
            for a, f in ex.get("funding", {}).items():
                funding.setdefault(a, f)
        ds = Dataset.from_events(cache["events"], cache["first_deposits"], txs=txs, funding=funding)
        print(f"enrichment extended: txs {len(ds.txs)} funding {len(ds.funding)}")
    cfg = preset.detect_config()
    firsts = first_rows(ds)
    counts = deposit_counts(ds)

    # --- human amount prior: ENS-named single-deposit wallets' first amounts ------
    human_amounts = [firsts[a].amount_wei for a in ens if a in firsts and counts[a] == 1]
    ac = collections.Counter(human_amounts)
    print(f"human amount prior from {len(human_amounts)} ENS single-deposit wallets; top:",
          [(sk_v2.eth(a), n) for a, n in ac.most_common(12)])

    # --- per-hour joiner counts and block ranges ------------------------------------
    per_hour = collections.Counter(d.hour for d in firsts.values())
    blocks_by_hour: dict[int, list[int]] = collections.defaultdict(list)
    for d in ds.deposits:
        blocks_by_hour[d.hour].append(d.block_number)
    block_range = {h: (min(b), max(b)) for h, b in blocks_by_hour.items()}
    extra = sk_v2.build_extra(ds, cache)
    farm_members = set().union(*extra["farm_windows"].values())
    farm_per_hour = collections.Counter(firsts[a].hour for a in farm_members)
    honest_per_hour = {h: max(0, per_hour[h] - farm_per_hour.get(h, 0)) for h in per_hour}
    print("joiners per hour (observed):", sum(per_hour.values()), "| honest density:", sum(honest_per_hour.values()))

    # --- gas fingerprint prior: measured control diversity -------------------------------
    pf_pool = [35_000_000, 100_000_000, 1_000_000, 50_000_000, 1_500_000_000, 2_000_000_000, 10_000_000, 500_000_000,
               30_000_000, 60_000_000, 120_000_000, 25_000_000, 75_000_000, 200_000_000, 1_200_000_000, 3_000_000_000,
               40_000_000, 80_000_000, 150_000_000, 300_000_000, 20_000_000, 90_000_000, 110_000_000, 45_000_000,
               55_000_000, 250_000_000, 700_000_000]
    gl_pool = [83_967, 84_000, 91_600, 113_508, 100_000, 120_000, 95_000, 88_000, 105_000, 150_000, 86_500, 92_000, 97_500, 110_000, 130_000]
    # --- empirical funder prior from NON-farm resolved rows -----------------------------
    contributors = set(firsts)
    op_hub = collections.Counter()
    for a in farm_members:
        f = ds.funding.get(a)
        if f and f.funder: op_hub[f.funder] += 1
    operator_hubs = {f for f, n in op_hub.items() if n >= 5}  # Disperse + operator distribution wallets
    funder_prior = []  # 'personal' | funder address (kept with real frequency)
    for a, f in ds.funding.items():
        if a in farm_members or f.funder is None: continue
        if f.funder in contributors or f.funder in operator_hubs: funder_prior.append("personal")
        else: funder_prior.append(f.funder)
    fp_c = collections.Counter(funder_prior)
    print(f"funder prior from {len(funder_prior)} non-farm resolved rows: personal={fp_c['personal']} ({fp_c['personal']/len(funder_prior):.0%}); top shared:", [(f[:10], n) for f, n in fp_c.most_common(8) if f != 'personal'])
    exch_like = {f for f, n in fp_c.items() if f != "personal" and n >= 10}
    print("exchange-like shared funders (>=10 honest-side wallets):", len(exch_like))
    coverage = len(ds.funding) / len(contributors)

    def synth(seed: int, density: dict[int, int]):
        rng = random.Random(seed)
        events, first_deps, txs, funding = [], [], {}, {}
        idx = 0
        rows = []
        for h in sorted(density):
            lo, hi = block_range.get(h, (25769870 + 300 * h, 25769870 + 300 * h + 299))
            for _ in range(density[h]):
                rows.append((rng.randint(lo, hi), h))
        rows.sort()
        for i, (blk, h) in enumerate(rows):
            idx += 1
            addr = f"0x{rng.getrandbits(160):040x}"
            amt = rng.choice(human_amounts)
            txh = f"0x{rng.getrandbits(256):064x}"
            events.append({"contributor": addr, "hour": h, "amount_wei": amt, "credited_delta_wei": amt, "weight_added_wei": amt,
                           "new_weight_wei": amt, "tx_count": 1, "block_number": blk, "tx_hash": txh, "log_index": i % 200, "ts": None})
            first_deps.append({"contributor": addr, "index": idx})
            txs[txh] = {"tx_hash": txh, "nonce": rng.choice([0, 0, 0, 1, 2, 5, 12, 40, 150]),
                        "max_priority_fee_wei": rng.choice(pf_pool), "max_fee_wei": rng.randint(50_000_000, 5_000_000_000),
                        "gas_limit": rng.choice(gl_pool), "tx_type": 2}
            if rng.random() < coverage:
                f = rng.choice(funder_prior)
                if f == "personal": f = f"0x{rng.getrandbits(160):040x}"
                funding[addr] = {"address": addr, "funder": f, "hops": 1}
        return Dataset.from_events(events, first_deps, txs=txs, funding=funding)

    from dataclasses import replace
    variants = {
        "shipped": sk_v2.Rules(),
        "v2b": replace(sk_v2.VARIANTS["v2b (peel books cadence)"], infra_extra=frozenset(exch_like)),
        "v2b+local2_strong": replace(sk_v2.VARIANTS["v2b + local2_strong"], infra_extra=frozenset(exch_like)),
        "ABCDE": sk_v2.VARIANTS["ABCDE combined"],
        "ABCDE+local2": sk_v2.VARIANTS["ABCDE + local2"],
        "ABCDE+local2+exchinfra": replace(sk_v2.VARIANTS["ABCDE + local2"], infra_extra=frozenset(exch_like)),
        "ABCDE2+local2+exchinfra": replace(sk_v2.VARIANTS["ABCDE2 + local2"], infra_extra=frozenset(exch_like)),
        "ABCDE2+local2_strong+exchinfra": replace(sk_v2.VARIANTS["ABCDE2 + local2_strong"], infra_extra=frozenset(exch_like)),
        "v2f": replace(sk_v2.VARIANTS["v2f (v2e + fresh hub + cex fan-out)"], infra_extra=frozenset(exch_like)),
        "v2g": replace(sk_v2.VARIANTS["v2g (v2f, coverage-stable fan-out)"], infra_extra=frozenset(exch_like)),
    }
    out = {}
    for dens_name, dens in (("honest_density", honest_per_hour),):
        for vname, rules in variants.items():
            fl, cl, fam = [], [], collections.Counter()
            for seed in range(5):
                sds = synth(seed, dens)
                clusters, edges, _, _ = sk_v2.run(sds, cfg, rules)
                flagged = {m for c in clusters for m in c["core"]}
                fl.append(len(flagged)); cl.append(len(clusters))
                for c in clusters:
                    fam[",".join(c["families"])] += 1
            n = sum(dens.values())
            out[f"{dens_name}/{vname}"] = {"population": n, "flagged_mean": statistics.mean(fl), "flagged_runs": fl,
                                           "clusters_mean": statistics.mean(cl), "family_combos": fam.most_common(6)}
            print(f"{dens_name:17s} {vname:14s} pop={n:6d} flagged={statistics.mean(fl):7.1f} ({min(fl)}–{max(fl)}) = {statistics.mean(fl)/n*100:4.1f}%  clusters={statistics.mean(cl):5.1f}  combos={fam.most_common(4)}")
    json.dump(out, open(f"{SCRATCH}/null_model.json", "w"), indent=1)


if __name__ == "__main__":
    main()
