import json, subprocess, time, sys
sys.path.insert(0,'.')
from sk_diag import load
from sybilkit.signals import first_rows
cache, ds, preset, ens, live = load()
firsts = first_rows(ds)
targets = json.load(open(sys.argv[1])); out = sys.argv[2]
def get(url):
    for i in range(3):
        o = subprocess.run(["curl","-s","-m","25","-H","User-Agent: aidude/1.0",url],capture_output=True,text=True).stdout
        try: return json.loads(o)
        except Exception: time.sleep(10)
    return None
funding, txs = {}, {}
for a in targets:
    if a not in ds.funding:
        j = get(f"https://eth.blockscout.com/api/v2/addresses/{a}/transactions?filter=to"); time.sleep(1.0)
        if j:
            items = [it for it in j.get("items", []) if int(it.get("value") or 0) > 0 and (it.get("to") or {}).get("hash","").lower()==a]
            funding[a] = {"address": a, "funder": (items[-1].get("from") or {}).get("hash","").lower() if items else None, "hops": 1 if items else None}
    h = firsts[a].tx_hash
    if h not in ds.txs:
        j = get(f"https://eth.blockscout.com/api/v2/transactions/{h}"); time.sleep(1.0)
        if j:
            txs[h] = {"tx_hash": h, "nonce": j.get("nonce"), "max_priority_fee_wei": int(j["max_priority_fee_per_gas"]) if j.get("max_priority_fee_per_gas") is not None else None,
                      "max_fee_wei": int(j["max_fee_per_gas"]) if j.get("max_fee_per_gas") is not None else None, "gas_limit": int(j.get("gas_limit") or 0), "tx_type": j.get("type")}
json.dump({"funding": funding, "txs": txs}, open(out, "w"), indent=1)
print("done", out, "funding", len(funding), "txs", len(txs))
