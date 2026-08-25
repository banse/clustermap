#!/usr/bin/env python3
"""Score a rule set against verified-honest controls, inside the full population.

The benchmark shipped with sybilkit runs `detect()` over 220 labelled wallets in
isolation and reports precision 1.0. Both halves are hollow: a control scored in
isolation can never be pulled into a cluster by the other 19,300 wallets — which
is the only way a false positive happens here — and the 60 "controls" were
sampled as non-audited rather than verified honest, so several are farm members.

This scores the same question honestly:

* controls come from `CONTROL_STANDARD.md`, pre-registered before the criteria
  were applied, and use no detector output of any kind;
* every wallet is scored inside one run over all 19,522;
* the control count is reported beside every rate, because a small denominator
  is a limit on the claim, not a detail to hide in a percentage.

What this can and cannot say: a control the detector links is a false positive,
and that rate is meaningful. Global precision is NOT reported — it would need
ground truth for all 19,522 wallets, which nobody has.
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import replace

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def _resolve_data():
    for c in (os.path.join(HERE, "..", "data"), os.path.join(HERE, "..", "..", "data", "sybil")):
        if os.path.isdir(c):
            return c
    return os.path.join(HERE, "..", "..", "data", "sybil")


DATA = os.environ.get("SYBIL_DATA") or _resolve_data()


def main():
    from sk_diag import load  # adds the resolved sybilkit source to sys.path
    from sybilkit import Dataset
    from sybilkit.signals import first_rows
    import sk_v2

    cache, _ds, preset, ens, live_groups = load()
    enr = cache["last_good"]["clusters"]["payload"]["enrichment"]
    txs, funding = dict(enr["txs"]), dict(enr["funding"])
    full = os.path.join(DATA, "enrichment", "full_enrich.json")
    if os.path.exists(full):
        ex = json.load(open(full))
        for h, t in ex.get("txs", {}).items():
            txs.setdefault(h, t)
        for a, f in ex.get("funding", {}).items():
            funding.setdefault(a, f)
    ds = Dataset.from_events(cache["events"], cache["first_deposits"], txs=txs, funding=funding)
    firsts = first_rows(ds)
    extra = sk_v2.build_extra(ds, cache)

    controls = set(json.load(open(os.path.join(DATA, "controls_verified.json"))))
    farms = set().union(*extra["farm_windows"].values())
    labeled = set(extra["labeled_members"])
    print(f"population {len(firsts)} | verified-honest controls {len(controls)} "
          f"| audited farm members {len(farms)} | labelled operator members {len(labeled)}")
    assert not (controls & farms), "a control is an audited farm member: the standard is broken"

    infra_path = os.path.join(DATA, "infra_all.json")
    infra = frozenset(a.lower() for a in json.load(open(infra_path))) if os.path.exists(infra_path) else frozenset()

    shipped = {(m["address"] if isinstance(m, dict) else m).lower()
               for g in live_groups for m in (g.get("members") or g.get("addresses") or [])}

    # Every row below is scored on the SAME complete dataset. The shipped rules
    # are also run with the derived exchange list v2 uses, so the comparison can
    # separate "v2 has better data" from "v2 has better rules".
    rows = [("shipped (published)", shipped, set())]
    base_infra_rules = replace(sk_v2.Rules(), infra_extra=infra) if infra else sk_v2.Rules()
    cl, _e, _f, _c = sk_v2.run(ds, preset.detect_config(), base_infra_rules)
    rows.append(("shipped + v2 infra", {m for c in cl for m in c["core"]}, set()))
    for name in ("v2g (v2f, coverage-stable fan-out)", "v2h (v2g + aged-weak periphery)"):
        rules = replace(sk_v2.VARIANTS[name], infra_extra=infra) if infra else sk_v2.VARIANTS[name]
        clusters, _edges, _f, _c = sk_v2.run(ds, preset.detect_config(), rules)
        rows.append((name.split(" (")[0], {m for c in clusters for m in c["core"]},
                     {m for c in clusters for m in c["periphery"]}))

    print(f"\n{'rule set':20s} {'controls REMOVED':>18s} {'+review':>8s} {'farm recall':>13s} {'labelled':>10s}")
    out = {}
    for name, flagged, periphery in rows:
        fp = controls & flagged
        pr = controls & periphery
        rec = len(farms & flagged) / len(farms)
        lab = len(labeled & flagged) / len(labeled)
        print(f"{name:20s} {len(fp):6d} / {len(controls):<4d} ({len(fp)/len(controls):5.1%}) "
              f"{len(pr):7d} {rec:12.1%} {lab:9.1%}")
        out[name] = {"controls": len(controls), "controls_flagged": len(fp),
                     "control_fp_rate": round(len(fp) / len(controls), 4),
                     "controls_in_periphery": len(pr),
                     "control_touched_rate": round((len(fp) + len(pr)) / len(controls), 4),
                     "farm_recall": round(rec, 4), "labeled_recall": round(lab, 4),
                     "flagged_total": len(flagged), "periphery_total": len(periphery),
                     "control_false_positives": sorted(fp),
                     "controls_marked_for_review": sorted(pr)}
        for a in sorted(fp)[:8]:
            t = ds.txs.get(firsts[a].tx_hash)
            print(f"    FP {a[:12]} ens={(ens.get(a) or [None])[0]} nonce={t.nonce if t else None} "
                  f"h{firsts[a].hour} {firsts[a].amount_wei / 10**18:.4f} ETH")
    json.dump(out, open(os.path.join(DATA, "bench_insitu.json"), "w"), indent=1)
    print(f"\nwrote {os.path.join(DATA, 'bench_insitu.json')}")
    print("'REMOVED' is the count taken off the clean list. '+review' is the periphery: shown as "
          "under review but NOT removed — the shipped rules have no such tier, so every wallet they "
          "flag is removed. Both are stated because reporting only the first would flatter v2.")
    print("Global precision is deliberately not reported: it would require ground truth for all "
          f"{len(firsts)} wallets. What is reported is the false-positive rate on wallets that meet a "
          "pre-registered standard, scored in situ.")


if __name__ == "__main__":
    main()
