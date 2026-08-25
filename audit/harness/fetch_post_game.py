#!/usr/bin/env python3
"""C5 of the control standard: did a candidate wallet survive the game?

A wallet farmed for a payout is emptied once the payout is fixed — its balance
goes to a collector shared with the operator's other wallets. A person's wallet
keeps living. This fetches each candidate's outgoing transfers in the week after
settlement and looks for the collector shape: a non-exchange recipient that more
than one candidate paid.

Keyless Blockscout, one request per wallet, resumable.
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
    here = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(here, "..", "data"), os.path.join(here, "..", "..", "data", "sybil")):
        if os.path.isdir(c):
            return c
    return os.path.join(here, "..", "..", "data", "sybil")


DATA = os.environ.get("SYBIL_DATA") or _resolve_data()
OUT = os.path.join(DATA, "enrichment", "post_game.json")
BS = "https://eth.blockscout.com/api"
WEEK_BLOCKS = 7 * 24 * 300  # ~12s blocks

_lock = threading.Lock()
_next = [0.0]
MIN_GAP = 0.22


def get(url, tries=4):
    for i in range(tries):
        with _lock:
            gap = _next[0] - time.monotonic()
            if gap > 0:
                time.sleep(gap)
            _next[0] = time.monotonic() + MIN_GAP
        p = subprocess.run(["curl", "-s", "-m", "30", "-w", "\n%{http_code}",
                            "-H", "User-Agent: aidude/1.0", url], capture_output=True, text=True)
        body, _, code = p.stdout.rpartition("\n")
        if code.strip() in ("429", "503"):
            time.sleep(0.5 * (i + 1))
            continue
        try:
            return json.loads(body)
        except Exception:
            time.sleep(0.4 * (i + 1))
    return None


def main():
    candidates = json.load(open(os.path.join(DATA, "control_candidates.json")))
    settle = int(sys.argv[1]) if len(sys.argv) > 1 else None
    if settle is None:
        raise SystemExit("usage: fetch_post_game.py <settlement_block>")
    done = json.load(open(OUT)) if os.path.exists(OUT) else {}
    todo = [a for a in candidates if a not in done]
    print(f"candidates {len(candidates)}, already fetched {len(done)}, to go {len(todo)}", flush=True)

    def one(addr):
        url = (f"{BS}?module=account&action=txlist&address={addr}"
               f"&startblock={settle}&endblock={settle + WEEK_BLOCKS}&sort=asc&page=1&offset=100")
        j = get(url)
        if j is None:
            return
        res = j.get("result")
        outs = []
        if isinstance(res, list):
            for it in res:
                if str(it.get("from") or "").lower() != addr:
                    continue
                value = int(it.get("value") or 0)
                if value <= 0:
                    continue
                outs.append({"to": str(it.get("to") or "").lower(), "value_wei": value,
                             "block": int(it.get("blockNumber") or 0)})
        with _lock:
            done[addr] = {"address": addr, "outgoing": outs}
            if len(done) % 50 == 0:
                json.dump(done, open(OUT, "w"))
                print(f"  {len(done)}/{len(candidates)}", flush=True)

    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(one, todo))
    json.dump(done, open(OUT, "w"))

    recipients = collections.Counter()
    for row in done.values():
        for o in row["outgoing"]:
            recipients[o["to"]] += 1
    shared = {r for r, n in recipients.items() if n > 1}
    print(f"\nfetched {len(done)} | distinct recipients {len(recipients)} | "
          f"recipients paid by >1 candidate: {len(shared)}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
