#!/usr/bin/env python3
"""Check the full-population enrichment against the sweep that produced the
existing rows — the only independent answer key available.

Two questions, both worth asking of data that is about to decide whether real
wallets keep their points:

1. **Does the one-request method agree with the 80-page walk?**  Re-resolve a
   sample of addresses maxpane already resolved (never written by this fetch)
   and compare funders.  Sampled twice: uniformly, and stratified onto wallets
   that had already sent >=100 transactions — the case where "oldest incoming
   transfer" is furthest from "first row of the response".
2. **Do the RPC tx rows match Blockscout's?**  Same fields, independent source.

Run it when nothing else is hitting Blockscout: a throttled request looks
exactly like a disagreement if you do not separate them, and an earlier pass of
this check reported 13/20 "mismatches" that were all 429s.
"""
from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import time

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
BS = "https://eth.blockscout.com/api"


def get(url, tries=5):
    """(json | None, throttled) — None only after `tries` genuine failures."""
    throttled = False
    for i in range(tries):
        p = subprocess.run(["curl", "-s", "-m", "30", "-w", "\n%{http_code}",
                            "-H", "User-Agent: aidude/1.0", url], capture_output=True, text=True)
        body, _, code = p.stdout.rpartition("\n")
        if code.strip() in ("429", "503"):
            throttled = True
            time.sleep(1.0 + i)
            continue
        try:
            return json.loads(body), throttled
        except Exception:
            time.sleep(0.5 + i)
    return None, throttled


def funder_of(a):
    j, t1 = get(f"{BS}?module=account&action=txlist&address={a}&sort=asc&page=1&offset=25")
    if j is None:
        return "UNREADABLE", t1
    res = j.get("result")
    if isinstance(res, list):
        for it in res:
            if str(it.get("to") or "").lower() == a:
                return str(it.get("from") or "").lower(), t1
    j2, t2 = get(f"{BS}?module=account&action=txlistinternal&address={a}&sort=asc&page=1&offset=25")
    if j2 is None:
        return "UNREADABLE", t1 or t2
    r2 = j2.get("result")
    if isinstance(r2, list):
        for it in r2:
            if str(it.get("to") or "").lower() == a and int(it.get("value") or 0) > 0:
                return str(it.get("from") or "").lower(), t1 or t2
    return None, t1 or t2


def check(sample, known, label, pause=0.5):
    ok = bad = unread = 0
    for a in sample:
        got, _ = funder_of(a)
        if got == "UNREADABLE":
            unread += 1
        elif got == known[a]["funder"]:
            ok += 1
        else:
            bad += 1
            print(f"  DIFF {a} one-request={got} walk={known[a]['funder']}")
        time.sleep(pause)
    print(f"{label}: agree {ok}/{ok+bad} (unreadable {unread}, excluded)")
    return ok, bad, unread


def main():
    from sk_diag import load
    from sybilkit.signals import first_rows

    n = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    cache, ds, preset, ens, live = load()
    firsts = first_rows(ds)
    known = cache["last_good"]["clusters"]["payload"]["enrichment"]["funding"]
    known = {a: v for a, v in known.items() if v.get("funder")}
    rng = random.Random(17)

    print(f"answer key: {len(known)} rows resolved by the paginated walk\n")
    check(rng.sample(sorted(known), n), known, f"uniform sample (n={n})")

    hot = [a for a in known if a in firsts and firsts[a].tx_hash in ds.txs
           and ds.txs[firsts[a].tx_hash].nonce >= 100]
    print(f"\nhigh-activity stratum: {len(hot)} wallets had sent >=100 txs before depositing")
    check(rng.sample(sorted(hot), min(n, len(hot))), known, f"high-nonce sample (n={min(n,len(hot))})")

    # --- tx rows -----------------------------------------------------------
    path = os.path.join(ENR, "full_txs.json")
    if os.path.exists(path):
        rows = json.load(open(path))
        print(f"\ntx rows fetched by RPC: {len(rows)}")
        ok = bad = unread = 0
        for h in rng.sample(sorted(rows), min(n, len(rows))):
            j, _ = get(f"https://eth.blockscout.com/api/v2/transactions/{h}")
            if not j or j.get("nonce") is None:
                unread += 1
                continue
            theirs = {"tx_hash": h, "nonce": j.get("nonce"),
                      "max_priority_fee_wei": int(j["max_priority_fee_per_gas"]) if j.get("max_priority_fee_per_gas") is not None else None,
                      "max_fee_wei": int(j["max_fee_per_gas"]) if j.get("max_fee_per_gas") is not None else None,
                      "gas_limit": int(j.get("gas_limit") or 0), "tx_type": j.get("type")}
            if theirs == rows[h]:
                ok += 1
            else:
                bad += 1
                print(f"  DIFF {h}\n    rpc {rows[h]}\n    bs  {theirs}")
            time.sleep(0.5)
        print(f"tx rows: agree {ok}/{ok+bad} (unreadable {unread}, excluded)")

    # --- coverage ----------------------------------------------------------
    full = os.path.join(ENR, "full_enrich.json")
    if os.path.exists(full):
        ex = json.load(open(full))
        fund = dict(cache["last_good"]["clusters"]["payload"]["enrichment"]["funding"])
        fund.update(ex.get("funding", {}))
        txs = dict(cache["last_good"]["clusters"]["payload"]["enrichment"]["txs"])
        txs.update(ex.get("txs", {}))
        have_tx = sum(1 for a in firsts if firsts[a].tx_hash in txs)
        print(f"\ncoverage: funding {len(set(fund) & set(firsts))}/{len(firsts)} "
              f"({len(set(fund) & set(firsts))/len(firsts):.2%}), first-deposit tx {have_tx}/{len(firsts)} "
              f"({have_tx/len(firsts):.2%})")
        print(f"funder=None (walked to the end, nothing incoming): "
              f"{sum(1 for a in firsts if a in fund and not fund[a].get('funder'))}")


if __name__ == "__main__":
    main()
