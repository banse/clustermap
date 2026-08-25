#!/usr/bin/env python3
"""What THE LIST is made of, once every contributor's funder is known.

Partial coverage (64 % of wallets) could only answer "does this pair share a
funder".  With every row resolved the population itself becomes measurable:
where the money entered from, how much of the list was funded by the list, and
how deep those chains run.  Reads the merged enrichment + ``funder_profile``
and writes ``full_census.json``.
"""
from __future__ import annotations

import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
def _resolve_data():
    """Evidence dir: `audit/data` in a clustermap checkout, `data/sybil` in the
    workspace this was written in. Override with env SYBIL_DATA."""
    here = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(here, "..", "data"), os.path.join(here, "..", "..", "data", "sybil")):
        if os.path.isdir(c):
            return c
    return os.path.join(here, "..", "..", "data", "sybil")


DATA = os.environ.get("SYBIL_DATA") or _resolve_data()
ENR = os.path.join(DATA, "enrichment")
ETH = 10**18


def main():
    from sk_diag import load
    from sybilkit import Dataset
    from sybilkit.curve import curve_points
    from sybilkit.signals import first_rows

    cache, ds0, preset, ens, live = load()
    enr = cache["last_good"]["clusters"]["payload"]["enrichment"]
    txs, funding = dict(enr["txs"]), dict(enr["funding"])
    for p in ("full_enrich.json", "ring_enrich.json", "ladder_enrich.json"):
        q = os.path.join(ENR, p)
        if os.path.exists(q):
            ex = json.load(open(q))
            for h, t in ex.get("txs", {}).items():
                txs.setdefault(h, t)
            for a, f in ex.get("funding", {}).items():
                funding.setdefault(a, f)
    ds = Dataset.from_events(cache["events"], cache["first_deposits"], txs=txs, funding=funding)
    firsts = first_rows(ds)
    pop = set(firsts)
    prof = json.load(open(os.path.join(DATA, "funder_profile.json")))

    weights = {}
    for d in sorted(ds.deposits, key=lambda d: (d.block_number, d.log_index)):
        weights[d.contributor] = d.new_weight_wei
    points = {a: curve_points(w, preset.points_per_eth) for a, w in weights.items()}
    total_pts = sum(points.values())
    deposits = collections.Counter(d.contributor for d in ds.deposits)

    print(f"contributors {len(pop)} | funding rows {len(ds.funding)} "
          f"({len(ds.funding)/len(pop):.1%}) | tx rows {len(ds.txs)} "
          f"({sum(1 for a in pop if firsts[a].tx_hash in ds.txs)/len(pop):.1%} of first deposits)")

    # --- where the money came from -------------------------------------------
    klass = {}
    for a in pop:
        f = ds.funding.get(a)
        if f is None:
            klass[a] = "unresolved"
        elif not f.funder:
            klass[a] = "no-incoming"
        else:
            p = prof.get(f.funder)
            klass[a] = p["class"] if p else "unprofiled"
    by = collections.Counter(klass.values())
    pts = collections.Counter()
    for a, k in klass.items():
        pts[k] += points.get(a, 0)
    print("\nfunding source of every contributor:")
    for k, n in by.most_common():
        print(f"  {k:12s} wallets {n:6d} ({n/len(pop):5.1%})  points {pts[k]/total_pts:6.2%}")

    # --- funded by the list itself (peel chains) ------------------------------
    parent = {}
    for a in pop:
        f = ds.funding.get(a)
        if f and f.funder in pop and f.funder != a:
            parent[a] = f.funder
    print(f"\nfunded by another contributor: {len(parent)} wallets "
          f"({len(parent)/len(pop):.1%}), {sum(points.get(a,0) for a in parent)/total_pts:.1%} of points")

    # The loose count above is *not* a sybil count: the 2026-08-18 research
    # measured 35 of 47 honest controls funding from their own main wallet,
    # which is itself a contributor.  The tight form is the one v2 treats as
    # evidence — funder deposited just before, at a like amount, into a wallet
    # that had barely transacted.
    tight = set()
    for a, p_ in parent.items():
        t = ds.txs.get(firsts[a].tx_hash)
        if t is None or t.nonce > 20:
            continue
        gap = firsts[a].block_number - firsts[p_].block_number
        if not (0 <= gap <= 30):
            continue
        x, y = firsts[a].amount_wei, firsts[p_].amount_wei
        if y and 0.75 <= x / y <= 1.25:
            tight.add(a)
    print(f"  of those, tight peel (funder deposited <=30 blocks earlier at a like "
          f"amount, child nonce<=20): {len(tight)} wallets "
          f"({sum(points.get(a,0) for a in tight)/total_pts:.1%} of points)")

    kids = collections.defaultdict(list)
    for c, p in parent.items():
        kids[p].append(c)
    depth = {}

    def depth_of(a, seen=None):
        if a in depth:
            return depth[a]
        seen = seen or set()
        if a in seen:
            return 0
        p = parent.get(a)
        d = 0 if p is None else 1 + depth_of(p, seen | {a})
        depth[a] = d
        return d

    sys.setrecursionlimit(10000)
    for a in pop:
        depth_of(a)
    dh = collections.Counter(depth.values())
    buckets = collections.Counter()
    for d in depth.values():
        if d == 0:
            continue
        buckets["1" if d == 1 else "2" if d == 2 else "3-5" if d <= 5 else "6-20" if d <= 20
                else "21-100" if d <= 100 else "101-1000" if d <= 1000 else "1000+"] += 1
    print("  chain depth (hops back inside the population):",
          {k: buckets[k] for k in ("1", "2", "3-5", "6-20", "21-100", "101-1000", "1000+") if buckets[k]})
    deepest = max(depth.values())
    tail = max(depth, key=lambda a: depth[a])
    print(f"  deepest chain: {deepest} hops (ends at {tail}, hour {firsts[tail].hour}, "
          f"{firsts[tail].amount_wei / ETH:.4f} ETH) — a single lump relayed wallet to wallet")

    # weakly-connected components over the parent links
    comp = {}
    for a in pop:
        if a not in parent and a not in kids:
            continue
        stack, seen = [a], set()
        if a in comp:
            continue
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            if x in parent:
                stack.append(parent[x])
            stack.extend(kids.get(x, ()))
        for x in seen:
            comp[x] = a
    groups = collections.defaultdict(set)
    for a, r in comp.items():
        groups[r].add(a)
    big = sorted(groups.values(), key=len, reverse=True)
    print(f"  peel-chain components: {len(big)} "
          f"(>=5 members: {sum(1 for g in big if len(g) >= 5)}), "
          f"largest {len(big[0]) if big else 0}")
    top = []
    for g in big[:12]:
        p = sum(points.get(a, 0) for a in g)
        hrs = sorted({firsts[a].hour for a in g})
        amts = collections.Counter(round(firsts[a].amount_wei / ETH, 4) for a in g)
        top.append({"size": len(g), "points_pct": round(p / total_pts * 100, 2),
                    "hours": [hrs[0], hrs[-1]], "top_amounts": amts.most_common(4),
                    "sample": sorted(g)[:5]})
        print(f"    size={len(g):5d} pts={p/total_pts:6.2%} hours {hrs[0]}-{hrs[-1]} "
              f"amounts {amts.most_common(3)}")

    # --- hubs: how many wallets share a funder -------------------------------
    deg = collections.Counter()
    for a in pop:
        f = ds.funding.get(a)
        if f and f.funder:
            deg[f.funder] += 1
    shared = {a for a in pop if (f := ds.funding.get(a)) and f.funder and deg[f.funder] >= 2}
    print(f"\nshare a first funder with >=1 other contributor: {len(shared)} "
          f"({len(shared)/len(pop):.1%})")
    for lo, hi in ((2, 2), (3, 5), (6, 20), (21, 100), (101, 10**9)):
        hubs = [h for h, n in deg.items() if lo <= n <= hi]
        w = sum(deg[h] for h in hubs)
        cls = collections.Counter((prof.get(h) or {}).get("class", "unprofiled") for h in hubs)
        print(f"  out-degree {lo}-{hi if hi < 10**8 else '+'}: {len(hubs):5d} funders, "
              f"{w:6d} wallets  {dict(cls)}")

    # --- freshness (nonce at the deposit) ------------------------------------
    nonces = {}
    for a in pop:
        t = ds.txs.get(firsts[a].tx_hash)
        if t is not None:
            nonces[a] = t.nonce
    nb = collections.Counter()
    for a, n in nonces.items():
        nb["0" if n == 0 else "1-4" if n < 5 else "5-19" if n < 20 else "20-99" if n < 100 else "100+"] += 1
    print(f"\nnonce at first deposit ({len(nonces)} known, {len(nonces)/len(pop):.1%}):")
    for k in ("0", "1-4", "5-19", "20-99", "100+"):
        p = sum(points.get(a, 0) for a, n in nonces.items()
                if (("0" if n == 0 else "1-4" if n < 5 else "5-19" if n < 20 else "20-99" if n < 100 else "100+") == k))
        print(f"  nonce {k:6s} {nb[k]:6d} wallets ({nb[k]/len(nonces):5.1%})  points {p/total_pts:6.2%}")

    out = {
        "contributors": len(pop),
        "funding_coverage": len(ds.funding) / len(pop),
        "tx_coverage": sum(1 for a in pop if firsts[a].tx_hash in ds.txs) / len(pop),
        "by_class": {k: {"wallets": n, "points_pct": round(pts[k] / total_pts * 100, 2)} for k, n in by.items()},
        "funded_by_contributor": {"wallets": len(parent),
                                  "points_pct": round(sum(points.get(a, 0) for a in parent) / total_pts * 100, 2)},
        "tight_peel": {"wallets": len(tight),
                       "points_pct": round(sum(points.get(a, 0) for a in tight) / total_pts * 100, 2)},
        "depth_hist": {str(k): v for k, v in sorted(dh.items())},
        "depth_buckets": dict(buckets),
        "deepest_chain": deepest,
        "components": top,
        "component_count": len(big),
        "shared_funder_wallets": len(shared),
        "nonce_hist": dict(nb),
        "deposits_hist": dict(collections.Counter(min(deposits[a], 10) for a in pop)),
    }
    json.dump(out, open(os.path.join(DATA, "full_census.json"), "w"), indent=1)
    print("\nwrote full_census.json")


if __name__ == "__main__":
    main()
