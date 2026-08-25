#!/usr/bin/env python3
"""Full-population enrichment for THE LIST: first funder + first-deposit tx row
for every contributor (19,522), resumable and keyless.

Two sources, each chosen for what it is actually good at:

* **txs** — ``eth_getTransactionByHash`` batched against a public node.  The
  fields the detector consumes (nonce, max fee / max priority fee, gas limit,
  type) are exactly what the RPC returns, and 100 hashes ride in one request.
  Verified row-for-row against 40 rows the maxpane sweep had already written:
  zero mismatches.
* **funding** — Blockscout's legacy ``txlist&sort=asc``.  The v2 walk in
  sybilkit pages a newest-first feed to its *last* page to reach the first
  funder (up to 80 requests for an old wallet); oldest-first answers the same
  question in one.  Falls back to ``txlistinternal`` when the external history
  has no incoming transfer — a disperse/multisend recipient is funded
  internally, and that is the fan-out the family exists to catch.  Verified
  against 150 rows from the maxpane sweep: 150/150 identical funders.

Semantics follow ``sybilkit.sources.blockscout`` exactly, because a row written
here is read as one written there:

* a resolved row is only written for an address whose history we read to the
  end; ``funder=None`` is a *measurement* (no incoming transfer found), never
  "we could not look".
* an address we could not read gets **no row** and stays pending, so a bad
  minute never freezes into a permanent answer.

Checkpoints after every batch, so a kill -9 costs at most one batch.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
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
BS = "https://eth.blockscout.com/api"

TX_OUT = os.path.join(ENR, "full_txs.json")
FUND_OUT = os.path.join(ENR, "full_funding.jsonl")
EXTRA_OUT = os.path.join(ENR, "full_funding_extra.jsonl")
PEND_OUT = os.path.join(ENR, "full_pending.json")
MERGED = os.path.join(ENR, "full_enrich.json")

_print_lock = threading.Lock()


def say(*a):
    with _print_lock:
        print(*a, flush=True)


class Limiter:
    """Requests/second ceiling shared by every worker, with 429 backoff."""

    def __init__(self, rate: float):
        self.min_gap = 1.0 / rate
        self.next_at = 0.0
        self.lock = threading.Lock()
        self.penalty = 0.0
        self.hits = 0
        self.reqs = 0

    def wait(self):
        with self.lock:
            now = time.monotonic()
            at = max(now, self.next_at)
            self.next_at = at + self.min_gap + self.penalty
            self.reqs += 1
        gap = at - time.monotonic()
        if gap > 0:
            time.sleep(gap)

    def throttled(self):
        with self.lock:
            self.hits += 1
            self.penalty = min(1.0, self.penalty * 2 + 0.05)

    def eased(self):
        with self.lock:
            self.penalty = max(0.0, self.penalty * 0.9 - 0.001)


def curl(url: str, lim: Limiter, tries: int = 4, post: str | None = None):
    """One keyless GET/POST as (parsed json | None).  None means unreadable."""
    for i in range(tries):
        lim.wait()
        cmd = ["curl", "-s", "-m", "30", "-w", "\n%{http_code}", "-H", "User-Agent: aidude/1.0"]
        if post is not None:
            cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", post]
        cmd.append(url)
        p = subprocess.run(cmd, capture_output=True, text=True)
        body, _, code = p.stdout.rpartition("\n")
        code = code.strip()
        if code == "429" or code == "503":
            lim.throttled()
            time.sleep(0.4 * (i + 1))
            continue
        lim.eased()
        try:
            return json.loads(body)
        except Exception:
            time.sleep(1.0 * (i + 1))
    return None


# ---------------------------------------------------------------- tx rows ---
def _hx(v):
    return int(v, 16) if isinstance(v, str) else (int(v) if v is not None else None)


def tx_row(h: str, r: dict) -> dict:
    return {
        "tx_hash": h,
        "nonce": _hx(r.get("nonce")),
        "max_priority_fee_wei": _hx(r.get("maxPriorityFeePerGas")),
        "max_fee_wei": _hx(r.get("maxFeePerGas")),
        "gas_limit": _hx(r.get("gas")) or 0,
        "tx_type": _hx(r.get("type")),
    }


def fetch_txs(hashes: list[str], lim: Limiter, workers: int, batch: int = 100) -> dict:
    out = {}
    if os.path.exists(TX_OUT):
        out = json.load(open(TX_OUT))
        hashes = [h for h in hashes if h not in out]
        say(f"[txs] resuming: {len(out)} already on disk, {len(hashes)} to go")
    lots = [hashes[i:i + batch] for i in range(0, len(hashes), batch)]
    done = [0]
    lock = threading.Lock()

    def one(lot):
        body = json.dumps([
            {"jsonrpc": "2.0", "id": i, "method": "eth_getTransactionByHash", "params": [h]}
            for i, h in enumerate(lot)
        ])
        j = curl(RPC, lim, post=body)
        got = {}
        if isinstance(j, list):
            for r in j:
                if isinstance(r, dict) and isinstance(r.get("result"), dict):
                    res = r["result"]
                    idx = r.get("id")
                    if isinstance(idx, int) and 0 <= idx < len(lot):
                        got[lot[idx]] = tx_row(lot[idx], res)
        with lock:
            out.update(got)
            done[0] += 1
            if done[0] % 10 == 0 or done[0] == len(lots):
                json.dump(out, open(TX_OUT, "w"))
                say(f"[txs] {done[0]}/{len(lots)} batches, {len(out)} rows")
        return len(lot) - len(got)

    if lots:
        with ThreadPoolExecutor(max_workers=max(2, workers // 2)) as ex:
            missed = sum(ex.map(one, lots))
        say(f"[txs] batch pass: {len(out)} rows, {missed} unresolved")
        # A batch answer can come back short for one id without failing — the
        # hash resolves fine on its own.  Sweep the remainder in small lots.
        for size in (10, 1):
            gaps = [h for h in hashes if h not in out]
            if not gaps:
                break
            say(f"[txs] retry {len(gaps)} in lots of {size}")
            lots2 = [gaps[i:i + size] for i in range(0, len(gaps), size)]
            with ThreadPoolExecutor(max_workers=max(2, workers // 2)) as ex:
                list(ex.map(one, lots2))
        json.dump(out, open(TX_OUT, "w"))
        gaps = [h for h in hashes if h not in out]
        say(f"[txs] done: {len(out)} rows, {len(gaps)} unresolved")
        if gaps:
            json.dump(gaps, open(os.path.join(ENR, "full_tx_gaps.json"), "w"), indent=1)
    return out


# ----------------------------------------------------------- funding rows ---
def funder_of(a: str, lim: Limiter):
    """(row, extra) or (None, reason) — no row unless the history was read."""
    j = curl(f"{BS}?module=account&action=txlist&address={a}&sort=asc&page=1&offset=25", lim)
    if j is None:
        return None, "unreadable"
    res = j.get("result")
    if isinstance(res, list):
        for it in res:
            if str(it.get("to") or "").lower() == a:
                extra = {
                    "address": a,
                    "funder_block": int(it.get("blockNumber") or 0),
                    "funder_value_wei": int(it.get("value") or 0),
                    "funder_ts": int(it.get("timeStamp") or 0),
                    "src": "external",
                }
                return {"address": a, "funder": str(it.get("from") or "").lower(), "hops": 1}, extra
    elif not (isinstance(res, str) and j.get("message") == "No transactions found"):
        return None, "unreadable"
    j2 = curl(f"{BS}?module=account&action=txlistinternal&address={a}&sort=asc&page=1&offset=25", lim)
    if j2 is None:
        return None, "unreadable"
    r2 = j2.get("result")
    if isinstance(r2, list):
        for it in r2:
            if str(it.get("to") or "").lower() == a and int(it.get("value") or 0) > 0:
                extra = {
                    "address": a,
                    "funder_block": int(it.get("blockNumber") or 0),
                    "funder_value_wei": int(it.get("value") or 0),
                    "funder_ts": int(it.get("timeStamp") or 0),
                    "src": "internal",
                }
                return {"address": a, "funder": str(it.get("from") or "").lower(), "hops": 1}, extra
    elif not (isinstance(r2, str) and j2.get("message") == "No transactions found"):
        return None, "unreadable"
    # Both histories read to the end with no incoming transfer: a measurement.
    return {"address": a, "funder": None, "hops": None}, {"address": a, "src": "none"}


def fetch_funding(addrs: list[str], lim: Limiter, workers: int) -> tuple[dict, dict]:
    rows, extras = {}, {}
    for path, sink in ((FUND_OUT, rows), (EXTRA_OUT, extras)):
        if os.path.exists(path):
            for line in open(path):
                line = line.strip()
                if line:
                    try:
                        r = json.loads(line)
                        sink[r["address"]] = r
                    except Exception:
                        pass
    todo = [a for a in addrs if a not in rows]
    if len(rows):
        say(f"[funding] resuming: {len(rows)} already on disk, {len(todo)} to go")
    fh = open(FUND_OUT, "a")
    fx = open(EXTRA_OUT, "a")
    pend = {}
    done = [0]
    lock = threading.Lock()
    t0 = time.time()

    def one(a):
        row, extra = funder_of(a, lim)
        with lock:
            if row is None:
                pend[a] = extra
            else:
                rows[a] = row
                extras[a] = extra
                fh.write(json.dumps(row) + "\n")
                fx.write(json.dumps(extra) + "\n")
            done[0] += 1
            n = done[0]
            if n % 250 == 0:
                fh.flush(); fx.flush()
                el = time.time() - t0
                say(f"[funding] {n}/{len(todo)} ({n/max(el,1e-9):.1f} addr/s, "
                    f"eta {(len(todo)-n)/max(n/el,1e-9)/60:.1f} min) pending={len(pend)} "
                    f"req={lim.reqs} 429={lim.hits} penalty={lim.penalty:.2f}")

    rounds = 0
    queue = todo
    while queue and rounds < 3:
        rounds += 1
        if rounds > 1:
            say(f"[funding] retry round {rounds} for {len(queue)} unreadable")
            pend.clear()
            done[0] = 0
            todo = queue
            t0 = time.time()
        with ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(one, queue))
        queue = list(pend)
    fh.close(); fx.close()
    json.dump(pend, open(PEND_OUT, "w"), indent=1)
    say(f"[funding] done: {len(rows)} rows, {len(pend)} still unreadable")
    return rows, extras


def main():
    ap = argparse.ArgumentParser(description="fetch first funder + deposit-tx row for every contributor")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--rate", type=float, default=5.0, help="global requests/second ceiling")
    ap.add_argument("--targets", default=os.path.join(ENR, "full_targets.json"))
    ap.add_argument("--skip-txs", action="store_true")
    ap.add_argument("--skip-funding", action="store_true")
    ap.add_argument("--merge-only", action="store_true",
                    help="rebuild full_enrich.json from the checkpoints, fetch nothing")
    args = ap.parse_args()

    os.makedirs(ENR, exist_ok=True)
    if args.merge_only:
        txs = json.load(open(TX_OUT)) if os.path.exists(TX_OUT) else {}
        rows = {}
        if os.path.exists(FUND_OUT):
            for line in open(FUND_OUT):
                if line.strip():
                    r = json.loads(line)
                    rows[r["address"]] = r
        # Fold in the earlier targeted fetches (ring / ladder) so this one file
        # is the whole population rather than "the whole population except the
        # 395 rows someone fetched first".
        for name in ("ring_enrich.json", "ladder_enrich.json"):
            q = os.path.join(ENR, name)
            if os.path.exists(q):
                ex = json.load(open(q))
                for a, r in ex.get("funding", {}).items():
                    rows.setdefault(a, r)
                for h, t in ex.get("txs", {}).items():
                    txs.setdefault(h, t)
        json.dump({"funding": rows, "txs": txs}, open(MERGED, "w"))
        say(f"merged -> {MERGED}: funding {len(rows)}, txs {len(txs)}")
        return
    t = json.load(open(args.targets))
    lim = Limiter(args.rate)
    say(f"targets: {len(t['funding_targets'])} funding, {len(t['tx_targets'])} txs "
        f"| {args.workers} workers, {args.rate} req/s ceiling")

    txs = {} if args.skip_txs else fetch_txs(t["tx_targets"], lim, args.workers)
    if args.skip_txs and os.path.exists(TX_OUT):
        txs = json.load(open(TX_OUT))
    rows = {}
    if not args.skip_funding:
        rows, _ = fetch_funding(t["funding_targets"], lim, args.workers)
    elif os.path.exists(FUND_OUT):
        rows = {json.loads(l)["address"]: json.loads(l) for l in open(FUND_OUT) if l.strip()}

    json.dump({"funding": rows, "txs": txs}, open(MERGED, "w"))
    say(f"merged -> {MERGED}: funding {len(rows)}, txs {len(txs)}")


if __name__ == "__main__":
    main()
