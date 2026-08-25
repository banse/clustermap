#!/usr/bin/env python3
"""Profile every first funder in THE LIST, and derive the infra list from data.

The shipped detector carries a hand-written 12-address CEX list, and the
reality-check harness extended it to 25 funders spotted by eye.  With funding
resolved for the whole population that guesswork is unnecessary: ask the chain
what each funder *is*.

Blockscout serves no public tags on this instance, so the classification is
behavioural and keyless — one batched ``eth_getTransactionCount`` +
``eth_getCode`` per funder:

* ``contract``   — has code: a router, disperse, or a smart account
* ``exchange``   — nonce >= 50,000: a hot wallet that pays out at industrial
  scale.  Sharing one of these is a base-rate coincidence, not evidence.
* ``service``    — nonce >= 2,000: a busy payer (small CEX, bridge, market
  maker, or a very active operator — treated as weak evidence)
* ``operator``   — nonce < 2,000 and >= 3 funded wallets in the population:
  the shape a farm funder actually has
* ``personal``   — everything else

Writes ``funder_profile.json`` (every funder with its class, nonce, out-degree)
and ``infra_cex_full.json`` (the exchange-scale set, for ``sk_v2 --infra``).
"""
from __future__ import annotations

import collections
import json
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

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
RPC = "https://ethereum-rpc.publicnode.com"

EXCHANGE_NONCE = 50_000
SERVICE_NONCE = 2_000
OPERATOR_DEGREE = 3


# Three public nodes that answer batched requests, rotated: a single one
# rate-limits (`-32005`) well before 26 k calls, and a rejected batch looks
# exactly like a set of addresses that do not exist — which would have written
# a funder profile with most of the population silently missing.
RPC_URLS = [RPC, "https://eth.merkle.io", "https://rpc.mevblocker.io"]
MIN_GAP = 0.4          # per endpoint
COOLDOWN = 90.0        # rest an endpoint that just said "rate limit exceeded"
_state = {u: {"next": 0.0, "cool": 0.0, "lock": threading.Lock()} for u in RPC_URLS}
_turn = [0]
_turn_lock = threading.Lock()


def _post(url: str, body: str):
    st = _state[url]
    if time.monotonic() < st["cool"]:
        return None
    with st["lock"]:
        gap = st["next"] - time.monotonic()
        if gap > 0:
            time.sleep(gap)
        st["next"] = time.monotonic() + MIN_GAP
    p = subprocess.run(
        ["curl", "-s", "-m", "30", "-X", "POST", "-H", "Content-Type: application/json", "-d", body, url],
        capture_output=True, text=True,
    )
    out = p.stdout
    if "-32005" in out or "rate limit" in out.lower() or out.startswith("error code:"):
        st["cool"] = time.monotonic() + COOLDOWN
        return None
    try:
        return json.loads(out)
    except Exception:
        return None


def rpc_batch(calls: list[dict], tries: int = 12):
    """One batched JSON-RPC call; returns {} only after every endpoint failed.

    A rejected batch looks exactly like a set of addresses that do not exist, so
    a partial answer is discarded rather than trusted — an earlier pass without
    this check profiled 600 of 13 k funders and reported the rest as unknown.
    """
    body = json.dumps(calls)
    with _turn_lock:
        _turn[0] += 1
        start = _turn[0]
    for i in range(tries):
        j = _post(RPC_URLS[(start + i) % len(RPC_URLS)], body)
        if isinstance(j, list) and len(j) == len(calls):
            got = {r.get("id"): r.get("result") for r in j
                   if isinstance(r, dict) and "result" in r}
            if len(got) == len(calls):
                return got
        if j is None:
            time.sleep(0.2)
        else:
            time.sleep(0.3 * (i + 1))
    return {}


def profile(funders: list[str], workers: int = 3, batch: int = 100) -> dict:
    """nonce + code for every funder.  One method per request: a batch mixing
    both came back empty often enough under concurrency that the run fell
    through to single lookups and crawled."""
    out: dict[str, dict] = {}
    lots = [funders[i:i + batch] for i in range(0, len(funders), batch)]
    lock = threading.Lock()
    done = [0]

    def one(lot):
        nonces = rpc_batch([{"jsonrpc": "2.0", "id": i, "method": "eth_getTransactionCount",
                             "params": [a, "latest"]} for i, a in enumerate(lot)])
        codes = rpc_batch([{"jsonrpc": "2.0", "id": i, "method": "eth_getCode",
                            "params": [a, "latest"]} for i, a in enumerate(lot)])
        got = {}
        for i, a in enumerate(lot):
            n, code = nonces.get(i), codes.get(i)
            if n is None or code is None:
                continue
            got[a] = {"nonce": int(n, 16), "code": code != "0x"}
        with lock:
            out.update(got)
            done[0] += 1
            if done[0] % 25 == 0 or done[0] == len(lots):
                print(f"[funders] {done[0]}/{len(lots)} batches, {len(out)} profiled", flush=True)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(one, lots))
    for size in (10, 1):
        gaps = [a for a in funders if a not in out]
        if not gaps:
            break
        print(f"[funders] retry {len(gaps)} in lots of {size}", flush=True)
        with ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(one, [gaps[i:i + size] for i in range(0, len(gaps), size)]))
    missing = [a for a in funders if a not in out]
    if missing:
        print(f"[funders] unprofiled: {len(missing)}", flush=True)
    return out


def classify(p: dict, degree: int, in_pop: bool) -> str:
    if p["code"]:
        return "contract"
    if p["nonce"] >= EXCHANGE_NONCE:
        return "exchange"
    if p["nonce"] >= SERVICE_NONCE:
        return "service"
    if in_pop:
        return "contributor"
    if degree >= OPERATOR_DEGREE:
        return "operator"
    return "personal"


def main():
    from sk_diag import load
    from sybilkit.signals import first_rows

    cache, ds, preset, ens, live = load()
    firsts = first_rows(ds)
    funding = dict(cache["last_good"]["clusters"]["payload"]["enrichment"]["funding"])
    full = os.path.join(ENR, "full_enrich.json")
    if os.path.exists(full):
        for a, f in json.load(open(full)).get("funding", {}).items():
            funding.setdefault(a, f)
    for p in ("ring_enrich.json", "ladder_enrich.json"):
        q = os.path.join(ENR, p)
        if os.path.exists(q):
            for a, f in json.load(open(q)).get("funding", {}).items():
                funding.setdefault(a, f)
    print(f"funding rows: {len(funding)} / {len(firsts)} contributors")

    degree = collections.Counter()
    for a, f in funding.items():
        if f.get("funder"):
            degree[f["funder"].lower()] += 1
    funders = sorted(degree)
    print(f"distinct funders: {len(funders)}")

    prof = profile(funders)
    rows = {}
    cls = collections.Counter()
    for a in funders:
        p = prof.get(a)
        if not p:
            continue
        k = classify(p, degree[a], a in firsts)
        cls[k] += 1
        rows[a] = {"nonce": p["nonce"], "contract": p["code"], "funded": degree[a], "class": k,
                   "in_population": a in firsts}
    print("classes:", dict(cls))
    wallets = collections.Counter()
    for a, r in rows.items():
        wallets[r["class"]] += r["funded"]
    print("wallets funded by class:", dict(wallets))
    json.dump(rows, open(os.path.join(DATA, "funder_profile.json"), "w"), indent=1)
    infra = sorted(a for a, r in rows.items() if r["class"] == "exchange")
    json.dump(infra, open(os.path.join(DATA, "infra_cex_full.json"), "w"), indent=1)
    # The wider gate: everything whose payout volume makes a shared funder a
    # base-rate coincidence rather than evidence — exchanges, busy services,
    # and contracts (routers / disperse / smart accounts).
    infra_all = sorted(a for a, r in rows.items() if r["class"] in ("exchange", "service", "contract"))
    json.dump(infra_all, open(os.path.join(DATA, "infra_all.json"), "w"), indent=1)
    print(f"wrote funder_profile.json ({len(rows)}), infra_cex_full.json ({len(infra)}), "
          f"infra_all.json ({len(infra_all)})")
    top = sorted(rows.items(), key=lambda kv: -kv[1]["funded"])[:25]
    for a, r in top:
        print(f"  {a} funded={r['funded']:5d} nonce={r['nonce']:>9d} {'contract' if r['contract'] else 'eoa':>8s} {r['class']}")


if __name__ == "__main__":
    main()
