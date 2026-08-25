#!/usr/bin/env python3
"""Builds the Sybilkit Reality Check report (HTML) from the harness outputs."""
from __future__ import annotations

import os

import collections
import html
import json
import re

def _resolve_data():
    """Evidence dir: `audit/data` in a clustermap checkout, `data/sybil` in the
    workspace this was written in. Override with env SYBIL_DATA."""
    here = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(here, "..", "data"), os.path.join(here, "..", "..", "data", "sybil")):
        if os.path.isdir(c):
            return c
    return os.path.join(here, "..", "..", "data", "sybil")


S = os.environ.get("SYBIL_DATA") or _resolve_data()
OUT = f"{S}/sybilkit-reality-check.html"


def parse_variants(path):
    rows = {}
    txt = open(path).read()
    for m in re.finditer(r"^(.+?)\s+clusters=\s*(\d+) flagged=\s*(\d+) periph=\s*(\d+) pts=\s*([\d.]+)% lab=(\d+)/(\d+) whole=(\d+)/(\d+) ens=\s*(\d+) ctrl=\s*(\d+) resc=\s*(\d+)(?: idmd=\s*(\d+))? ladder=\s*(\d+)\n\s+farm windows: (.*)$", txt, re.M):
        name = m.group(1).strip()
        fw = dict((k.strip(), v) for k, v in re.findall(r"(.+?)=(\d+/\d+)(?:\s+|$)", m.group(15)))
        rows[name] = dict(clusters=int(m.group(2)), flagged=int(m.group(3)), periph=int(m.group(4)), pts=float(m.group(5)),
                          lab=f"{m.group(6)}/{m.group(7)}", whole=f"{m.group(8)}/{m.group(9)}", ens=int(m.group(10)), ctrl=int(m.group(11)),
                          resc=int(m.group(12)), idmd=(int(m.group(13)) if m.group(13) else None), ladder=int(m.group(14)), fw=fw)
    return rows


final = parse_variants(f"{S}/v2_final.log") if __import__("os").path.exists(f"{S}/v2_final.log") else {}
ring = parse_variants(f"{S}/v2_ring.log")
noinfra = parse_variants(f"{S}/v2_final_noinfra.log")
base = parse_variants(f"{S}/v2_base.log")["baseline(shipped)"]
final2 = parse_variants(f"{S}/v2_final2.log") if __import__("os").path.exists(f"{S}/v2_final2.log") else {}
v2 = final2.get("v2f (v2e + fresh hub + cex fan-out)") or final.get("v2e (v2d + jitter band + residual)") or ring["v2e (v2d + jitter band + residual)"]
v2_source = "ring + ladder enrichment" if (final or final2) else "ring enrichment only"
null = json.load(open(f"{S}/null_model.json"))
# The full-coverage rerun (every contributor's funder resolved) — optional, so
# the report still builds from the partial-coverage logs alone.
full_base = parse_variants(f"{S}/v2_full_base.log") if os.path.exists(f"{S}/v2_full_base.log") else {}
full_v2 = parse_variants(f"{S}/v2_full.log") if os.path.exists(f"{S}/v2_full.log") else {}
census = json.load(open(f"{S}/full_census.json")) if os.path.exists(f"{S}/full_census.json") else None
# Headline on the complete-coverage run when there is one; the partial-coverage
# row stays available so the section below can show both.
_v2_partial = v2
if full_v2:
    v2 = (full_v2.get("v2h (v2g + aged-weak periphery)")
          or full_v2.get("v2g (v2f, coverage-stable fan-out)")
          or full_v2.get("v2f (v2e + fresh hub + cex fan-out)") or v2)
    v2_source = "complete enrichment (every contributor)"
diff = json.load(open(f"{S}/v2_diff.json"))
diag = json.load(open(f"{S}/clusters_diag.json"))
idmd = json.load(open(f"{S}/idmd_flagged.json"))


def n(x):
    return f"{x:,}"


# ---------- charts ----------------------------------------------------------------
def col_chart_hours(rel_by_hour: dict, w=1000, h=260):
    """Released wallets by join hour (single series)."""
    hours = list(range(0, 67))
    vals = [rel_by_hour.get(str(hh), rel_by_hour.get(hh, 0)) for hh in hours]
    top = max(vals) or 1
    step = 100 if top > 300 else 50
    ymax = ((top // step) + 1) * step
    pl, pr, pt, pb = 44, 12, 12, 30
    cw = (w - pl - pr) / len(hours)
    bw = min(24, cw - 2)
    parts = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="Released wallets by join hour" class="chart">']
    for g in range(0, ymax + 1, step):
        y = pt + (h - pt - pb) * (1 - g / ymax)
        parts.append(f'<line x1="{pl}" x2="{w-pr}" y1="{y:.1f}" y2="{y:.1f}" class="grid"/>')
        parts.append(f'<text x="{pl-6}" y="{y+4:.1f}" class="tick" text-anchor="end">{g:,}</text>')
    for i, (hh, v) in enumerate(zip(hours, vals)):
        x = pl + i * cw + (cw - bw) / 2
        bh = (h - pt - pb) * v / ymax
        y = h - pb - bh
        parts.append(f'<g class="bar"><title>hour {hh}: {v:,} released</title><rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="4" ry="4" class="s2"/>'
                     f'<rect x="{x:.1f}" y="{max(y, h-pb-4):.1f}" width="{bw:.1f}" height="{min(4, bh):.1f}" class="s2"/></g>')
        if hh % 6 == 0:
            parts.append(f'<text x="{x + bw/2:.1f}" y="{h-pb+16}" class="tick" text-anchor="middle">h{hh}</text>')
    i34 = hours.index(34)
    x34 = pl + i34 * cw + cw / 2
    parts.append(f'<text x="{x34:.1f}" y="{pt+10}" class="label" text-anchor="middle">h34–35: the imd.fun rally</text>')
    parts.append("</svg>")
    return "".join(parts)


def grouped_bars(pairs, w=560, h=190, unit="%"):
    """pairs: [(label, shipped, v2)] horizontal grouped bars, 2 series."""
    pl, pr, pt, pb = 190, 60, 8, 8
    rowh = (h - pt - pb) / len(pairs)
    bh = min(18, rowh / 2 - 3)
    vmax = max(max(a, b) for _, a, b in pairs) or 1
    parts = [f'<svg viewBox="0 0 {w} {h}" role="img" class="chart">']
    for i, (lab, a, b) in enumerate(pairs):
        y0 = pt + i * rowh
        parts.append(f'<text x="{pl-10}" y="{y0 + rowh/2 + 4:.1f}" class="label" text-anchor="end">{html.escape(lab)}</text>')
        for k, (val, cls) in enumerate(((a, "s1"), (b, "s3"))):
            bw = (w - pl - pr) * val / vmax
            y = y0 + 3 + k * (bh + 4)
            parts.append(f'<g class="bar"><title>{html.escape(lab)} — {"shipped" if k==0 else "v2"}: {val}{unit}</title>'
                         f'<rect x="{pl}" y="{y:.1f}" width="{max(bw,2):.1f}" height="{bh}" rx="4" ry="4" class="{cls}"/>'
                         f'<rect x="{pl}" y="{y:.1f}" width="{min(4,max(bw,2)):.1f}" height="{bh}" class="{cls}"/>'
                         f'<text x="{pl + max(bw,2) + 6:.1f}" y="{y + bh - 4:.1f}" class="value">{val}{unit}</text></g>')
    parts.append("</svg>")
    return "".join(parts)


def meter(a, b, tot):
    pa, pb = (a / tot * 100 if tot else 0), (b / tot * 100 if tot else 0)
    return (f'<div class="meter"><span class="m1" style="width:{pa:.1f}%"></span></div>'
            f'<div class="meter"><span class="m3" style="width:{pb:.1f}%"></span></div>')


# ---------- data for tables --------------------------------------------------------
rel_by_hour = collections.Counter(r["hour"] for r in diff["released"])
rel_by_amount = collections.Counter(r["amount_eth"] for r in diff["released"])

fw_names = [
    ("0.45@h3-4", "0.45 ETH ×1,996, hours 3–4 (audited)"),
    ("14.0@h3-15", "14.0 ETH ×1,003, hours 3–15 (audited)"),
    ("10.0@h5", "10.0 ETH ×770, hour 5 (audited)"),
    ("1.2@h1-2", "1.2 ETH ×300, hours 1–2 (audited)"),
    ("2.067", "2.067 ETH ×324, two waves (audited)"),
    ("idxrun_12058", "jitter batch 12,058–12,157 (audited)"),
    ("idxrun_13326", "jitter batch 13,326–13,425 (audited)"),
    ("idxrun_13795", "jitter batch 13,795–13,894 (audited)"),
    ("idxrun_13897", "jitter batch 13,897–13,996 (audited)"),
    ("idxrun_14001", "jitter batch 14,001–14,100 (audited)"),
    ("0.45@h34-37", "0.45 ETH ×367, hours 34–37 (new batch)"),
    ("ring99(any", "≈99 ETH peel-chain ring, hours 16–19 (15.6 % of all points)"),
    ("ladder10.x(5-step", "9.9→10.3 ETH 5-step ladder engine, hours 37–45"),
    ("ladder0.05→0.45(h35-37)", "0.05→0.45 ETH 5-step ladders from exchange withdrawals, h35–37"),
    ("jitter1.10-1.14(h36-55)", "1.10–1.14 ETH unique-amount drip, hours 36–55"),
    ("jitter1.00-1.05(h56-64)", "1.00–1.05 ETH unique-amount drip, hours 56–64"),
    ("bitget-ladder", "Bitget-6 withdrawal loop, 1.19–1.69 ETH, hours 17–31"),
    ("0.05 recyclers", "0.05 ETH recyclers (three small hubs), hours 10–35"),
]


def fw_get(row, key):
    for k, v in row["fw"].items():
        if k.startswith(key):
            a, b = v.split("/")
            return int(a), int(b)
    return None


recall_rows = []
for key, label in fw_names:
    b = fw_get(base, key)
    v = fw_get(v2, key)
    if b is None and v is not None:
        b = (None, v[1])
    if v is None:
        continue
    recall_rows.append((label, b[0] if b else None, v[0], v[1]))

# variant table (single-rule ablations + candidate)
variant_names = [
    ("baseline(shipped)", "shipped sybilkit 0.1.1"),
    ("A round windows ≤32 blocks", "A · round-amount windows bounded at 32 blocks"),
    ("B min exempt everywhere", "B · protocol minimum exempt from sequence/cadence too"),
    ("C odd: jitter_only (≤5 decimals = round)", "C · 'odd amount' = ≥6 decimals only"),
    ("D near: jitter_only", "D · near-same-block only between jitter amounts"),
    ("E hub_min 5", "E · shared-funder hub needs ≥5 members"),
    ("F member gate local2", "F · per-member gate (≥2 families at the wallet)"),
    ("ABCDE combined", "A–E combined"),
    ("ABCDE2 + local2", "A–E + tightened sequence + per-member gate"),
]
var_rows = [(lbl, noinfra[k]) for k, lbl in variant_names if k in noinfra]

null_rows = [(lbl, null.get(key)) for lbl, key in (
    ("shipped rules", "honest_density/shipped"),
    ("A–E combined", "honest_density/ABCDE"),
    ("A–E + per-member gate", "honest_density/ABCDE+local2"),
    ("v2 candidate", "honest_density/v2h"),
    ("v2, minimum group size 4", "honest_density/v2h min_size=4"),
    ("v2, minimum group size 3", "honest_density/v2h min_size=3"),
) if null.get(key)]

# top clusters table
def cl_rows():
    out = []
    keep = [2, 0, 7, 6, 1, 8, 3, 4, 14, 19, 21, 164, 51]
    d = {r["cluster_id"]: r for r in diag}
    rel = collections.Counter(r["baseline_cluster"] for r in diff["released"])
    for cid in keep:
        r = d[cid]
        out.append(r | {"released": rel.get(cid, 0)})
    return out


verdict = {2: "farm", 0: "farm (+14.3 ETH batch welded in)", 7: "≈87 % honest crowd", 6: "≈78 % farm, honest tail", 1: "farm",
           8: "farm (new operator)", 3: "farm (aged wallets)", 4: "farm", 14: "farm — Bitget withdrawal loop", 19: "farm — Bitget loop",
           21: "≈80 % farm, 11 honest", 164: "mostly honest", 51: "mostly honest (3 IDMD holders)"}

fp_examples = [
    ("idonotknowwhatimdoing.eth", "0xbaaba861464f25f52c2ee10cc3ac024f4f77812a", 7, "sequence + burst in the h34 rally; hub = FTX-2-labelled exchange wallet", "nonce 11,361 · holds 12 IDMD · 50+ NFT collections"),
    ("985.eth", "0x61fd0d043d519f5a2bd05785000f30db96809429", 7, "one consecutive-index run at h34", "nonce 22,182 · DEX trader"),
    ("mehmethan.eth", "0x3195c3f94154364e897711e501e104f40d8e23fb", 6, "24-hour 0.1 ETH window + '≈W/k split'", "nonce 34,704 · 102 txs after the game"),
    ("tonybearbrick.eth", "0x17e566d94b9e9471eaaa1fd48fed92666fe0e6c0", 6, "0.1 window + one drip edge by block adjacency", "nonce 4,532 · holds 1 IDMD · 2.15 ETH"),
    ("racylife.eth", "0x2a967ab031ecd90ad2b4e1b6c4436a29f7a5f33e", 7, "sequence only", "8-step ladder 0.05→0.75 · nonce 423"),
    ("punk.austingriffith.eth", "0xc1470707ed388697a15b9b9f1f5f4cc882e28a45", 7, "sequence + drip at h7", "subname of austingriffith.eth · active since 2024"),
    ("0xmhd.eth", "0x070f565dfd13906eba848374c34a4485bd21e876", 7, "'identical odd 0.051 ETH' (194 wallets, all 66 hours)", "nonce 775 · topped up from own second wallet"),
    ("lehson1308.eth", "0xeae9870e408327733aacba4bdc33fc14822a48da", 21, "1.0 ETH round window + near-block", "nonce 1,458 · 1,576 txs · deposited 0.99"),
    ("justdefaultname.eth", "0x10f9ec8e7967ba8c391830374ad6ee51de6c3ca3", 19, "single near-block edge into the Bitget ladder", "1.45 ETH is not a ladder amount · nonce 1,371"),
    ("gulocrypto.eth", "0x4789f8ed86858dd6879104781293a98569b46b16", 225, "0.25 ETH window + shared exchange funder ×2", "nonce 1,626 · bridging before and after"),
    ("赚钱给女儿买奶粉.eth", "0xc490bc9e50933600a2a7dc213e69851d8d56098e", 181, "consecutive-index run 16,468–16,498 at h34", "nonce 6,716 · 16 distinct contracts"),
    ("0008888.eth", "0x22a676b52392591bc6c7caf51c14b38f5e0f3716", 7, "sequence run 5,892–5,897 + exchange hub", "nonce 7,257 · 7,992 lifetime txs"),
]

# ---------- HTML ------------------------------------------------------------------
css = """
:root{--bg:#f4f4ef;--bg2:#ffffff;--ink:#14171a;--ink2:#4d5561;--mute:#7a828d;--rule:#d9dbd2;--accent:#2a78d6;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;
--crit:#d03b3b;--ser:#ec835a;--warn:#fab219;--good:#0ca30c;--chip:#e9eae3;--code:#eef0ea;--shadow:0 1px 0 rgba(20,23,26,.06)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#16181a;--bg2:#1e2124;--ink:#f0efe9;--ink2:#a9aeb6;--mute:#7d8590;--rule:#2b2f33;--accent:#3987e5;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--chip:#272b2f;--code:#22262a;--shadow:none}}
:root[data-theme="dark"]{--bg:#16181a;--bg2:#1e2124;--ink:#f0efe9;--ink2:#a9aeb6;--mute:#7d8590;--rule:#2b2f33;--accent:#3987e5;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--chip:#272b2f;--code:#22262a;--shadow:none}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.55}
.wrap{max-width:1080px;margin:0 auto;padding:40px 24px 80px}
h1,h2,h3{font-family:"Bricolage Grotesque","IBM Plex Sans",sans-serif;text-wrap:balance;letter-spacing:-.01em;margin:0}
h1{font-size:clamp(34px,5vw,54px);line-height:1.02;font-weight:800}
h2{font-size:26px;font-weight:700;margin-top:56px;padding-top:18px;border-top:1px solid var(--rule)}
h3{font-size:18px;font-weight:700;margin-top:28px}
p,li{max-width:70ch}
.lede{font-size:19px;color:var(--ink2);max-width:66ch;margin-top:14px}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.meta{display:flex;flex-wrap:wrap;gap:14px 28px;margin-top:18px;color:var(--ink2);font-size:14px}
code,.mono{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
code{background:var(--code);padding:1px 5px;border-radius:4px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:30px 0 8px}
.tile{background:var(--bg2);border:1px solid var(--rule);border-radius:8px;padding:14px 16px;box-shadow:var(--shadow)}
.tile .l{font-size:13px;color:var(--ink2)}
.tile .v{font-size:30px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:6px;white-space:nowrap}
.tile .v small{display:block;font-size:15px;color:var(--ink2);font-weight:500;margin-top:4px;white-space:nowrap}
.tile .d{font-size:13px;color:var(--mute);margin-top:6px}
.chip{display:inline-flex;align-items:center;gap:6px;font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:var(--chip);color:var(--ink2)}
.chip::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--mute)}
.chip.crit::before{background:var(--crit)}.chip.ser::before{background:var(--ser)}.chip.warn::before{background:var(--warn)}.chip.good::before{background:var(--good)}
.finding{background:var(--bg2);border:1px solid var(--rule);border-radius:8px;padding:18px 20px;margin-top:14px;box-shadow:var(--shadow)}
.finding h3{margin-top:6px}
.finding .ev{color:var(--ink2);font-size:15px}
.finding .fix{margin-top:10px;padding-left:12px;border-left:3px solid var(--accent);font-size:15px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media (max-width:820px){.grid2{grid-template-columns:1fr}}
table{border-collapse:collapse;width:100%;font-size:14.5px;font-variant-numeric:tabular-nums}
th,td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--rule)}
th{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:500}
td.num,th.num{text-align:right}
.tbl{overflow-x:auto;margin-top:12px;background:var(--bg2);border:1px solid var(--rule);border-radius:8px;padding:6px 8px}
.meter{height:6px;background:var(--rule);border-radius:3px;margin:3px 0;min-width:120px}
.meter span{display:block;height:100%;border-radius:3px}
.m1{background:var(--s1)}.m3{background:var(--s3)}
.legend{display:flex;gap:18px;font-size:13px;color:var(--ink2);margin:8px 0 2px}
.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.chart{width:100%;height:auto;display:block;margin-top:8px}
.chart .grid{stroke:var(--rule);stroke-width:1}
.chart .tick{fill:var(--mute);font-family:"IBM Plex Mono",monospace;font-size:11px}
.chart .label{fill:var(--ink2);font-family:"IBM Plex Sans",sans-serif;font-size:12.5px}
.chart .value{fill:var(--ink);font-family:"IBM Plex Mono",monospace;font-size:12px}
.chart .s1{fill:var(--s1)}.chart .s2{fill:var(--s2)}.chart .s3{fill:var(--s3)}
.chart .bar:hover rect{opacity:.75}
.fig{background:var(--bg2);border:1px solid var(--rule);border-radius:8px;padding:14px 16px;margin-top:14px}
.fig .cap{font-size:13.5px;color:var(--ink2);margin-top:6px}
.addr{font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--ink2);word-break:break-all}
ul.tight li{margin:4px 0}
.callout{border:1px solid var(--rule);border-left:4px solid var(--s2);background:var(--bg2);padding:14px 18px;border-radius:6px;margin-top:18px}
.two{columns:2;column-gap:28px}@media (max-width:820px){.two{columns:1}}
a{color:var(--accent)}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
"""

flag_rate = base["flagged"] / 19522 * 100
v2_rate = v2["flagged"] / 19522 * 100
null_ship = null["honest_density/shipped"]
null_v2 = (null.get("honest_density/v2h") or null.get("honest_density/v2g")
           or null.get("honest_density/v2f") or null.get("honest_density/v2b")
           or null["honest_density/ABCDE2+local2+exchinfra"])
bench = json.load(open(f"{S}/bench_insitu.json")) if os.path.exists(f"{S}/bench_insitu.json") else None

doc = []
A = doc.append
A(f"""<meta charset="utf-8">
<title>Sybilkit Reality Check</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>{css}</style>
<div class="wrap">
<div class="eyebrow">THE LIST · WhitelistCurator 0xcB0b…DA91 · Ethereum mainnet · settled hour 66 · 19,522 wallets</div>
<h1 style="margin-top:10px">Sybilkit Reality Check</h1>
<p class="lede">The shipped detector removes <strong>{n(base['flagged'])} wallets ({flag_rate:.0f} %)</strong> from THE LIST's clean list. Re-running it on the settled population, dissecting every cluster, sampling ~600 wallets on-chain and testing the rules against an operator-free null model shows two problems at once: roughly <strong>1.5–2.3 thousand honest wallets</strong> are flagged for typing a common amount at a busy minute or withdrawing from the same exchange, while <strong>one ≈99 ETH peel-chain operator holding 15.6 % of all points sits 81 % unflagged in the published clean list</strong>. A rule set built on the same evidence families fixes both, measured below.</p>
<div class="meta"><span>Analysis date 2026-08-25</span><span>Detector: sybilkit 0.1.1 (curator preset, tiers A+B+C)</span><span>Data: settled maxpane cache, block 25,827,557</span><span>Method: 11 investigations + skeptic verification, keyless, read-only</span><span>Enrichment: every contributor's first funder, every deposit's transaction</span></div>

<div class="tiles">
<div class="tile"><div class="l">Wallets flagged</div><div class="v">{n(base['flagged'])}<small>→ {n(v2['flagged'])} under v2</small></div><div class="d">not a smaller net: v2 releases {n(len(diff['released']))} wallets and adds {n(len(diff['newly_flagged']))} that carry funding evidence</div></div>
<div class="tile"><div class="l">Points flagged</div><div class="v">{base['pts']:.1f} %<small>→ {v2['pts']:.1f} % under v2</small></div><div class="d">v2 removes small honest wallets and adds the unflagged whale farms</div></div>
<div class="tile"><div class="l">Null model: honest wallets flagged</div><div class="v">{null_ship['flagged_mean']/null_ship['population']*100:.1f} %<small>→ {null_v2['flagged_mean']/null_v2['population']*100:.1f} % under v2</small></div><div class="d">synthetic population with zero operators, 5 seeds</div></div>
<div class="tile"><div class="l">ENS-named wallets flagged</div><div class="v">{base['ens']}<small>→ {v2['ens']} under v2</small></div><div class="d">of 1,387 named contributors; undisputed farms name 0.05 % of their wallets</div></div>
<div class="tile"><div class="l">IDMD identity-NFT holders flagged</div><div class="v">{len(idmd['flagged'])}<small>→ {v2['idmd']} under v2</small></div><div class="d">of {len(idmd['holders_in_pop'])} holders on THE LIST (0.25–0.35 ETH each)</div></div>
<div class="tile"><div class="l">≈99 ETH ring recovered</div><div class="v">{fw_get(base,'ring99(any')[0]} / {fw_get(v2,'ring99(any')[1]}<small>→ {fw_get(v2,'ring99(any')[0]} / {fw_get(v2,'ring99(any')[1]} under v2</small></div><div class="d">one operator, 40 peel chains, 15.6 % of all points</div></div>
</div>

<h2>What the numbers say</h2>
<p>Every audited farm wave from the 2026-08-17 research (0.45 ETH ×1,996, 14.0 ×1,003, 10.0 ×770, 1.2 ×300, 2.067 ×324, the five 100-wallet jitter batches, the 171.99 ring) is recovered at ≥99.4 % by the shipped detector <em>and</em> by every variant tested here. The disagreement is entirely about who else gets pulled in, and about what the rules cannot see. The asymmetry is points-weighted: the honest wallets wrongly flagged are almost all 0.05–0.2 ETH senders (disputable flagged wallets with ≥5 ETH credit outside audited clusters hold 0.17 % of points), while the unflagged machine mass — the ≈99 ETH ring (12.6 % of points unflagged), the 1.0–1.14 ETH relay (3.4 %), the ladder engines (1.9 %) and further unique-amount bands (≤5.6 %) — is roughly a fifth of all points sitting in the clean list.</p>
<div class="grid2">
<div class="fig"><div class="eyebrow">Flag rate · real population vs operator-free null</div>
<div class="legend"><span><i style="background:var(--s1)"></i>shipped</span><span><i style="background:var(--s3)"></i>v2 candidate</span></div>
{grouped_bars([("THE LIST (real)", round(flag_rate,1), round(v2_rate,1)), ("null model, honest density", round(null_ship['flagged_mean']/null_ship['population']*100,1), round(null_v2['flagged_mean']/null_v2['population']*100,1))])}
<div class="cap">The null population copies the real join pace, the amount distribution of ENS-named wallets and the real first-funder mix (61 % personal wallets, 29 exchange-scale hubs). Every wallet the rules link there is a false positive by construction. The shipped rules link {null_ship['flagged_mean']/null_ship['population']*100:.0f} % of it — almost their real-population rate.</div></div>
<div class="fig"><div class="eyebrow">Wallets the v2 candidate releases, by join hour</div>
{col_chart_hours(rel_by_hour)}
<div class="cap">{n(len(diff['released']))} wallets released; {rel_by_hour[34]+rel_by_hour[35]:,} of them joined in hours 34–35, right after the dev posted <code>site: https://www.imd.fun/</code> on the announce channel (h32.7) and the community rushed in with 0.05 ETH sends. By amount: {', '.join(f"{a} ETH ×{c}" for a,c in rel_by_amount.most_common(6))}.</div></div>
</div>

<h2>How the shipped detector goes wrong</h2>
<p>sybilkit's thesis is sound — score clusters, never convict on one family — but three implementation choices turn it into single-linkage clustering over weak evidence. The findings below were each produced by one investigation, then attacked by an independent skeptic; where the skeptic narrowed a claim the narrower version is stated.</p>
""")

findings = [
    ("crit", "The gate is per component, the evidence is per wallet",
     "Families are booked on the union-find root and the ≥2-family test runs once per component, while every signal emits a spanning chain over sorted addresses. A wallet attached by a single weak edge inherits families it never touched. Measured on the live output: 868 flagged members touch no strong rule (odd-jitter amount, burst, drip, sequence, peel chain), 1,148 members carry exactly one family at the wallet, and 126 ENS-named wallets with nonce ≥ 20 are flagged with no strong rule at all.",
     "cluster.py:223-227 and :248; spanning chains at amounts.py:117, split.py:62, cadence.py:70, gas.py:113, funding.py:119. Example: mehmethan.eth (nonce 34,704) is in the 896-wallet 0.1 ETH cluster via two round-window edges only.",
     "Gate per member: a wallet is core only if ≥2 distinct families are incident on it; everything else is periphery — reported, not removed from the clean list. Measured: −1,050 to −1,566 wallets (skeptic: ≈490–700 of them honest by nonce/ENS, 10 of 12 sampled aged wallets genuine), every audited wave ≥99.5 % retained. The gate must ship together with the new builder families below, otherwise it also releases ~750 farm wallets that only carry one family today."),
    ("crit", "Round-amount 'waves' have no width, so the two most human amounts become the two biggest clusters",
     "A round-amount window only closes after a >1-hour silence. 0.1 ETH was sent continuously for 24 hours, so 545 wallets form one window (cluster 6, 896 members: a real 421-wallet legacy-tx peel-chain farm plus a 300-wallet jitter batch, plus ≈100–170 aged 0.1 ETH senders with own gas defaults and 57 ENS names — a fresh sample of the released ones was ≈85 % human). The '≈W/k split' rule then narrates a fictional 54.5 ETH pot. Cluster 7 (998 members, 0.05–0.06 ETH, hours 0–59) is the same mechanism: 156 ENS names, 60 % nonce ≥ 20, 396 distinct priority fees, 8 % funder-in-cluster — a crowd.",
     "signals/__init__.py:135-144 (MAX_HOUR_GAP). On-chain sample of cluster 7: 43 of 54 human-like; machine share ≈97 wallets (a 40-wallet Disperse batch at 0.051, ~50 nonce-0 peel wallets, one h15 batch) = 0.09 % of all points.",
     "Bound round windows at 32 blocks (the 2026-08-17 v1 rule). Every audited wave spans ≤308 blocks and is retained ≥99.7 %; cluster 6 loses exactly its honest tail (100 wallets, 27 ENS, 0 fingerprint farm wallets)."),
    ("crit", "'Identical odd amount' gives 0.051 the population-wide reach meant for 0.082193701937108305",
     "Anything not a multiple of 0.01 ETH is a machine fingerprint that links across all 66 hours. On the minimum-plus-buffer band — 0.051 (×194 over 40 hours), 0.052, 0.053, 0.055, 0.056, 0.058, 0.059, 0.061, each spread over 16–34 hours at ≤1 per block with 44–112 distinct funders, 20–45 % ENS and 56–83 % nonce ≥ 20 — that reach is the bridge that welds cluster 7 out of 12+ unrelated components. Three skeptics put the honest share of the ≈430–480 wallets held by such an edge alone between 150 and 375 (the band also hides aged-wallet batches created in 2023 with identical contract sets, a 25-wallet peel-chained batch at h1 and an 18-wallet relay at h5), i.e. ≈0.2–0.4 % of points. The same 'short odd amount' class also contains real farms (the 2.067 waves, Disperse same-block batches at 0.091/0.124/0.185, the 0.063 peel chain, an 18-wallet relay chain from 0xdc4931c3 at h5) — so the fix is to window short odd amounts, not to drop them.",
     "amounts.py:102 (ROUND_WEI test). Only 15 groups / 39 wallets have ≥6 significant digits. The real machine fingerprint the rule was meant to catch lives in the sub-cent residual: 27 wallets share …99997663984/…99997666744 wei across six whole amounts (a max-send-minus-gas script) and 22 of them are unflagged. Sampled carriers: 0xmhd.eth (nonce 775), chessman.eth (nonce 259, funded 106 days earlier), liminhoo.eth (662-day-old wallet).",
     "Global reach only for ≥6-decimal amounts or shared ≥6-digit residuals; window ≤5-decimal odd amounts like round ones (32 blocks). Measured: −577 flagged, 0 of the 40 Disperse wallets and 0 of the 2.067 waves lost."),
    ("crit", "The protocol minimum is exempt from the amount rules but convicted by sequence and cadence",
     "Ruling R13b exempts byte-identical 0.05 from amount/split, but sequence (±10 %, so 0.05 chains to 0.055), burst and drip have no exemption. In hours 32–36 the community rally sent 1,356 deposits at exactly 0.05 (72–89 % of joiners, 1.9–2.4 joins per block): 'five consecutive join indices ≤2 blocks apart' is then arithmetic, not coordination. A within-hour amount-shuffle null reproduces the real run membership exactly (885 vs 897 ± 23). 773 rally 0.05 senders are flagged; ~35 of them belong to two real recyclers (0x3230466e…, 0x2e0db3f8…).",
     "sequence.py:57-66, cadence.py:53-106; c7 hour histogram h34 = 317, h35 = 125; 27 late clusters (362 wallets): 202 nonce ≥ 20, 27 ENS, 25 ladderers, 23 of 30 sampled human-like. The hour rescuers of h34/h35 are among the flagged.",
     "Exempt the near-minimum band (≤1.25 × min) from identity rules, sequence and drip; keep burst. Catch the real recyclers with a fresh-hub rule (≥3 nonce-0 wallets, one small funder, deposits within 2 hours, funds returned)."),
    ("ser", "'Shared first funder ×2' with a 12-address exchange list",
     "Two members of a component sharing a first funder is a family unless the funder is one of 12 ChainCred CEX wallets. The hubs that actually fire are Bitget 6 (5.4 M txs), Binance 18 (9.9 M), OKX Hot Wallet 3, OKX 24, OKX 3, an 'FTX 2'-labelled wallet, further exchange-scale EOAs with 0.4–12.6 M txs, a bridge proxy, and one zero-value dust sender. 37 clusters (551 wallets) clear the gate only through such a hub; 56 of 153 hubs are ×2. A skeptic partitioned those 551: 251 sit in clusters with strong single-operator evidence (the Bitget loop), 172 in 16 small clusters (0.26 % of points) are coincidental welds of aged wallets, 44 mixed.",
     "funding.py:102-111, labels.py. Sampled members of the hub-only clusters c216/c218/c232/c228/c184/c225: 14 of 14 aged wallets with ENS/DeFi history.",
     "Classify funders by scale: a keyless sweep of all 164 hub funders found 73 exchange-scale (54 publicly labelled: Binance 2–20, OKX, Bybit, Bitget, MEXC, Gate, KuCoin, HTX, Kraken, Coinbase, Crypto.com, Relay/Orbiter/Layerswap solvers …), 7 contracts (Disperse, deBridge, Across …), and only 20 funders that are load-bearing at all. Do not exclude exchanges outright — see the Bitget loop below — make exchange hubs base-rate aware (count only when N ≥ 5 and ≥ 50 % of the component, or when both endpoints were nonce 0 at deposit). Measured: −118 to −232 wallets, Bitget ring retained. Treat EIP-7702 code (0xef0100…) as an EOA, never as infra."),
    ("ser", "The five families are mostly one observation, and confidence cannot fall below 0.77",
     "Round-wave, split, near-block, sequence, burst and drip all fire on 'same amount, same minutes'; a position-shuffle null reproduces 76 % of burst edges, 90 % of near-block edges and 29 % of sequence edges by chance. Noisy-OR over strengths ≥0.7 with a freshness floor of 0.85 gives a minimum confidence of 0.774, so the 0.5 'flagged' threshold never excludes anything: 0 of 263 clusters fall below it, including 110 clusters (2,671 wallets) with ≤30 % fresh wallets.",
     "cluster.py:257-271; observed confidence min 0.786, median 0.925.",
     "Collapse rules into evidence classes (amount-time proximity · machine amount fingerprint · funding structure · engine ladder · freshness) and gate on ≥2 classes; calibrate the clean-list cut on the null model's false-linking rate."),
    ("good", "The benchmark's precision 1.0 was an artefact — rebuilt",
     "bench.py runs detect() over the 220 labelled wallets in isolation, so a control can never be pulled into a ≥5-member component by the other 19,300 wallets. In situ, 30 of the 60 'controls' are flagged — and the controls were random non-audited wallets, several of which are jitter-batch or ~99 ETH ring members, so they are not verified-honest either.",
     "bench.py:146, tests/test_bench.py:60.",
     "Done, and it changed the headline. Controls were rebuilt against a standard fixed before it was applied and scored in situ: 308 wallets carrying a verifiable independent history, none of them audited farm members. The published rules remove 84 of them (27.3 %); the v2 rules remove 1 (≤0.3 %, and that one is a farm member the standard admitted). See the section below."),
]
for chip, title, claim, ev, fix in findings:
    A(f'<div class="finding"><span class="chip {chip}">{ {"crit":"critical","ser":"serious","warn":"gate","good":"resolved"}[chip] }</span><h3>{html.escape(title)}</h3><p>{html.escape(claim)}</p><p class="ev"><strong>Evidence</strong> · {html.escape(ev)}</p><div class="fix"><strong>Fix</strong> · {html.escape(fix)}</div></div>')

A(f"""
<h2>What the shipped detector cannot see</h2>
<p>The false positives are cheap wallets: the released set holds under 2 % of all points. The false negatives are the expensive ones.</p>
""")
fns = [
    ("crit", "One ≈99 ETH peel-chain operator, 15.6 % of all points, 81 % unflagged",
     "418 wallets deposited 90–110 ETH in hours 15–19 (387 single deposits at 51 randomised amounts on a 0.1 ETH grid, 31 with a small first deposit and ~97 ETH later). Two independent re-derivations agree: one ≈102 ETH lump was relayed serially through the whole set — each wallet deposits, is refunded, and forwards the lump to the next wallet ~12 s later (347 of 349 resolved first funders are the previous ring member, zero chain-order violations), after a 32-wallet 1.6–1.7 ETH dry run at h15; 194 fresh nonce-0 wallets plus ~155 pre-aged wallets sharing byte-identical warm-up scripts, sub-milligwei priority fees, gas dust swept to one collector after settlement. Only 81 are flagged (2.99 % of points); 337 unflagged wallets hold 12.6 % of all points. The peel-chain rule is corroboration-only: it counts inside a tier-A component, and 33 of the ring's amount windows are single-family components the ≥2-family gate discards.",
     "funding.py:89-90. Example hop: 0xdad06928 (unflagged) 100.18 ETH in at 12:23:47 → deposit 96.9 at 12:23:59 → 101.90 out at 12:24:11 → next wallet deposits 99.5 at 12:24:23 → … Consolidation sink 0x2135c4c6 → 0xbc214bc9. Verified by two skeptics (confidence 0.92–0.95).",
     "Make a tight peel chain a component-building family: funder is a contributor whose own deposit landed ≤30 blocks earlier with a like amount, funded wallet nonce ≤20 at deposit (warm-ups reach 5–10). Measured with funders resolved for the ring: 397 of 419 recovered."),
    ("crit", "Multi-deposit ladder engines are invisible by design",
     "Every amount rule runs on single-deposit wallets only, to protect human ladderers — 2,037 multi-deposit wallets hold 13.6 % of points, and 25 of the 27 deposit sequences shared by ≥5 wallets are ordinary human 0.05-step ladders (0.05→0.15 ×206 with 39 ENS names). The other two are engines: ~176 wallets each performing the identical 5-rung ladder 9.9→10.3 / 10.0→10.4 ETH in 4–5 consecutive blocks, serialised one wallet at a time as peel chains (10.39–10.80 ETH in, swept to dust), hours 37–46, 1.9 % of points, 0 flagged — these wallets 'rescued' hours 38–46. Plus ~111 fresh wallets funded 0.4999–0.5 ETH from Binance 18 / OKX / Binance 16 seconds apart, each running the identical 0.05→0.45 ladder in hours 35–37 (9 flagged), and 32–35 multi-deposit members of the ≈99 ETH ring (1.2 % of points).",
     "signals/__init__.py:68-78 (single_first_rows). A skeptic checked the 'tiny first deposit, then ≥5 ETH' set (143 wallets): mostly human test deposits (29 ENS, nonce median 205), not evasion — the engines above are the real cost.",
     "Add a ladder-fingerprint family (≥5 wallets, byte-identical ≥3-rung tuples, first deposits within 300 blocks) and run amount rules over each wallet's largest deposit. Natural human ladders (0.05, 0.15, 0.25 … forced by the +0.1 escalation rule) still need a second family, so they stay periphery: under v2 the engines are 176/176 recovered while ENS-named flagged wallets stay at 19 — 28 at complete coverage, and the eleven added are farms rather than people (lixy4.eth, lixy5.eth, lixy10.eth, moreairdrop.eth, holdbayc.eth, all running the same 0.05→0.35 ladder)."),
    ("ser", "Unique jittered amounts in a narrow band beat every rule",
     "One ≈1.18 ETH lump relayed serially through ~965 wallets in hours 36–64 at unique 1.0004–1.1469 ETH amounts (3.4 % of all points, 0 ENS, 0 flagged): each wallet receives 1.16–1.18 ETH from the previous hop, makes four 0-value self-sends, deposits at nonce 4 and sweeps its full balance to a fresh address 12 s later — a byte-identical script on 6 of 6 wallets checked, one hop every ~84 s interleaved with organic joiners. Unique amounts defeat identical/odd, spread-out timing defeats near-block, burst and drip, interleaving defeats sequence, and at audit time no enrichment rows existed for them, so peel/gas could never fire. It earned more points than the 300-wallet 1.2 ETH farm and kept the game alive from hour 47 to 64. A further 2,048 unflagged single-deposit wallets with unique ≥6-digit amounts (5.6 % of points, 3 ENS) sit in similar same-hour bands. Those have since been resolved: under the v2 rules the same set is 446 wallets and 1.2 % of points, so 78 % of that gap closes with the rules already measured here. Of the 446 that remain, 248 carry no evidence edge at all and 196 sit in components below the five-member minimum — and lowering that minimum to three is measurably the wrong trade: it recovers 102 of them and 0.8 points of credit while tripling the false-linking rate on the operator-free null population (0.1 % → 0.3 %), where the dominant false link becomes one person's two or three wallets funded from the same place. The residual is the deliberate price of the ≥5 rule.",
     "Completeness critic's on-chain check (0xa7711ede, 0x65a46770, 0x8b64f126, 0x0ec94374, 0x8839456c, 0xbbc92944); hour_saved rows for h47–64 are 1.1051 / 1.1195 / 1.1309 / … ETH senders. Of the 7,949 unflagged wallets only 613 had a tx row and 925 a funding row at audit time; all 19,522 contributors are enriched now.",
     "Add an engine-pocket family: ≥20 unique ≥6-decimal amounts within a 2 % band in one hour is amount evidence and timing evidence at once — measured 329 / 541 and 121 / 300 recovered at audit-time coverage, without touching ENS/IDMD collateral. That prediction has since been tested: with every first funder resolved the tight peel chain (funder = previous hop, like amount, nonce 4) does carry the whole relay — 540 / 541 and 300 / 300."),
    ("ser", "Exchange withdrawals as a fan-out — and a warning against excluding exchanges",
     "Clusters 14/19/24/58/80 (237 wallets, staggered 1.19–1.69 ETH, hours 17–31) are flagged only through the 'shared first funder' hub on Bitget 6. They are a real operator: 36 of 36 sampled wallets show withdrawal of deposit + 0.0098 ETH → deposit ≈1 minute later → full sweep to a fresh address → return to Bitget 6 within minutes, all nonce 0, one priority fee. A blanket exchange exclusion would free them; a freshness-gated exchange hub keeps them.",
     "agent_xhub evidence: e.g. 0x8189775b… funded 1.5998 at 00:14, deposit 1.59 +1.2 min, swept 1.5994 +1 min, forwarded to Bitget 6 at 00:19.",
     "Exchange hubs count only when both endpoints were nonce 0 at deposit; add a 'refill-and-sweep' signal from the wallet's own history (incoming ≈ deposit within 60 min before, ≥90 % out within 60 min after). Write the fan-out test as an absolute count on a fee value that is uncommon population-wide, never as a share of the funder's group: the first version required ≥90 % of the group and caught this operator 232/232 at partial coverage, then went silent (0/239) once complete enrichment grew the group to 310 and the same 244 wallets became 78.7 % of it. Re-measured, 238/239."),
    ("good", "Enrichment covered only tier-A candidates — closed, and the answer was not what it promised",
     "In the shipped pipeline transaction fingerprints (12,203) and first funders (12,498) are fetched only for wallets already inside a tier-A component, so the ring, the ladder engines and the jitter series could never gain a corroborating family while honest wallets inside welded components were fully enriched and convicted; 36 % of contributors had no funding row. That pipeline defect still stands. The gap itself is now closed offline: a first funder for all 19,522 contributors and a transaction fingerprint for all 28,353 deposits.",
     "curator_clusters.py candidates-only fetch_enrichment. Closed 2026-08-25 by tools/sybil/fetch_all_enrich.py — ~23 k keyless lookups in ~50 min (Blockscout oldest-first answers 'first funder' in one request where the library's walk pages a newest-first feed up to 80 times); verified 60/60 against that paginated walk on a uniform sample and 60/60 on wallets that had already sent ≥100 transactions.",
     "Done — and the result is the sharpest finding in this report. With every funder resolved the shipped detector's output does not move by a single wallet (263 clusters, 11,573 flagged, ring still 81/419), because its funding family only corroborates components the behavioural rules already built. Complete data is worth nothing to a fold-only rule and a great deal to one that lets funding structure build a component: the very same rows carry v2 from 450/841 to 840/841 on the 1.0–1.14 ETH relay. Make the pipeline enrich the population, not the candidate set — but do not expect coverage alone to fix recall."),
]
for chip, title, claim, ev, fix in fns:
    A(f'<div class="finding"><span class="chip {chip}">{ {"crit":"critical","ser":"serious","warn":"coverage","good":"resolved"}[chip] }</span><h3>{html.escape(title)}</h3><p>{html.escape(claim)}</p><p class="ev"><strong>Evidence</strong> · {html.escape(ev)}</p><div class="fix"><strong>Fix</strong> · {html.escape(fix)}</div></div>')

# cluster anatomy table
A("""<h2>Cluster anatomy</h2>
<p>Real farms and welded crowds look nothing alike once the fingerprints the library already collects are read per cluster. Fresh-wallet share, distinct priority fees, funder-in-cluster share and ENS share separate them without any on-chain lookup.</p>
<div class="tbl"><table><thead><tr><th>cluster</th><th class="num">size</th><th>dominant amount · hours</th><th class="num">ENS %</th><th class="num">nonce 0 %</th><th class="num">nonce ≥20 %</th><th class="num">distinct fees</th><th class="num">funder in cluster %</th><th class="num">no strong rule</th><th class="num">released by v2</th><th>verdict</th></tr></thead><tbody>""")
for r in cl_rows():
    A(f"<tr><td class=\"mono\">c{r['cluster_id']}</td><td class=\"num\">{n(r['size'])}</td><td>{r['dominant_amount_eth']} ETH · h{r['hour_min']}–{r['hour_max']}</td><td class=\"num\">{r['ens_members']/r['size']*100:.1f}</td><td class=\"num\">{int((r['nonce0_frac'] or 0)*100)}</td><td class=\"num\">{int((r['nonce_ge20_frac'] or 0)*100)}</td><td class=\"num\">{r['distinct_priority_fees']}</td><td class=\"num\">{int((r['funder_in_cluster_frac'] or 0)*100)}</td><td class=\"num\">{r['no_strong_rule']}</td><td class=\"num\">{r['released']}</td><td>{html.escape(verdict.get(r['cluster_id'],''))}</td></tr>")
A("</tbody></table></div>")

# FP examples
A("""<h2>Twelve wallets the clean list should not have lost</h2>
<p>All verified on-chain (keyless Blockscout). The attaching rule is the only reason each one is in a cluster.</p>
<div class="tbl"><table><thead><tr><th>wallet</th><th>cluster</th><th>attached by</th><th>why it is a person</th></tr></thead><tbody>""")
for name, addr, cid, rule, why in fp_examples:
    A(f"<tr><td><strong>{html.escape(name)}</strong><br><span class=\"addr\">{addr}</span></td><td class=\"mono\">c{cid}</td><td>{html.escape(rule)}</td><td>{html.escape(why)}</td></tr>")
A("</tbody></table></div>")

# variants table
A(f"""<h2>Measured rule changes</h2>
<p>Each row is the shipped detector with one change, run on the settled population. Farm recall is reported on the eleven audited waves; 'labelled' is the 160 audited members (the 22–30 lost under B are the three 0.05-minimum crowds the audit itself called 'provably mixed').</p>
<div class="tbl"><table><thead><tr><th>rule set</th><th class="num">clusters</th><th class="num">flagged</th><th class="num">points %</th><th class="num">labelled</th><th class="num">ENS flagged</th><th class="num">ladderers</th><th>audited waves</th></tr></thead><tbody>""")
for lbl, r in var_rows:
    waves = sum(1 for k in ("0.45@h3-4","14.0@h3-15","10.0@h5","1.2@h1-2","2.067","idxrun_12058","idxrun_13326","idxrun_13795","idxrun_13897","idxrun_14001","0.45@h34-37") if fw_get(r,k) and fw_get(r,k)[0] >= 0.99*fw_get(r,k)[1])
    A(f"<tr><td>{html.escape(lbl)}</td><td class=\"num\">{r['clusters']}</td><td class=\"num\">{n(r['flagged'])}</td><td class=\"num\">{r['pts']:.1f}</td><td class=\"num\">{r['lab']}</td><td class=\"num\">{r['ens']}</td><td class=\"num\">{r['ladder']}</td><td>{waves}/11 ≥99 %</td></tr>")
A(f"<tr><td><strong>v2 candidate</strong> (A–E, per-member gate, tight peel chain, ladder + engine-pocket families, exchange hubs gated on freshness; {v2_source})</td><td class=\"num\">{v2['clusters']}</td><td class=\"num\"><strong>{n(v2['flagged'])}</strong></td><td class=\"num\"><strong>{v2['pts']:.1f}</strong></td><td class=\"num\">{v2['lab']}</td><td class=\"num\"><strong>{v2['ens']}</strong></td><td class=\"num\">{v2['ladder']}</td><td>11/11 ≥99 %</td></tr>")
A("</tbody></table></div>")

A(f"""<h3>Recall on known operators</h3>
<div class="legend"><span><i style="background:var(--s1)"></i>shipped</span><span><i style="background:var(--s3)"></i>v2 candidate</span></div>
<div class="tbl"><table><thead><tr><th>operator wave</th><th class="num">wallets</th><th class="num">shipped</th><th class="num">v2</th><th>recall</th></tr></thead><tbody>""")
for label, b, v, tot in recall_rows:
    A(f"<tr><td>{html.escape(label)}</td><td class=\"num\">{n(tot)}</td><td class=\"num\">{b if b is not None else '—'}</td><td class=\"num\">{v}</td><td>{meter(b or 0, v, tot)}</td></tr>")
A("</tbody></table></div>")

A("""<h3>Null model</h3>
<p>A synthetic population with no operators: observed per-hour join counts minus the audited waves (13.8 k wallets), amounts drawn from ENS-named single-deposit wallets, blocks uniform inside each hour, first funders drawn from the real non-farm funder mix, gas fingerprints with the measured control diversity. Five seeds per rule set.</p>
<div class="tbl"><table><thead><tr><th>rule set</th><th class="num">honest wallets flagged</th><th class="num">rate</th><th>what links them</th></tr></thead><tbody>""")
for lbl, r in null_rows:
    if not r:
        continue
    if not isinstance(r, dict) or "flagged_mean" not in r:
        continue
    A(f"<tr><td>{html.escape(lbl)}</td><td class=\"num\">{r['flagged_mean']:.0f} ({min(r['flagged_runs'])}–{max(r['flagged_runs'])})</td><td class=\"num\">{r['flagged_mean']/r['population']*100:.1f} %</td><td class=\"mono\">{html.escape(', '.join(f'{k} ×{v}' for k,v in r['family_combos'][:3]))}</td></tr>")
A("</tbody></table></div>")


# ---------- full-population enrichment -------------------------------------------
if census:
    cls_order = ["exchange", "contributor", "personal", "service", "contract", "operator", "no-incoming", "unresolved", "unprofiled"]
    cls_label = {"exchange": "Exchange hot wallet", "contributor": "Another wallet on THE LIST",
                 "personal": "A personal wallet (funded 1–2)", "service": "A busy service wallet",
                 "contract": "A contract (router / disperse / smart account)",
                 "operator": "A small operator hub (funded ≥3)", "no-incoming": "No incoming transfer found",
                 "unresolved": "Still unresolved", "unprofiled": "Funder not profiled"}
    bc = census["by_class"]
    nh = census["nonce_hist"]
    nh_tot = sum(nh.values()) or 1
    fbc = census["funded_by_contributor"]
    A(f"""<h2>Complete enrichment: the whole population, resolved</h2>
<p>Everything above was measured on the coverage the live sweep had reached — a first funder for
{n(12498)} of {n(census['contributors'])} contributors (64 %) and a deposit-tx fingerprint for
{n(12203)}. The funding family is the detector's strongest evidence and its most expensive, so
that gap cut both ways: it hid peel chains from the rules and it left every conclusion about
funding structure resting on two thirds of the list. The remaining rows were fetched
afterwards — first funder for every contributor, and a tx fingerprint for
<em>every deposit</em>, not just the first.</p>
<div class="tiles">
<div class="tile"><div class="l">First funder resolved</div><div class="v">{census['funding_coverage']*100:.1f} %<small>was 64.0 %</small></div><div class="d">{n(census['contributors'])} contributors, no key, ~7 k lookups</div></div>
<div class="tile"><div class="l">Deposit tx fingerprints</div><div class="v">100 %<small>was 43.0 %</small></div><div class="d">all {n(28353)} deposits, not just first ones</div></div>
<div class="tile"><div class="l">Funded by another wallet on THE LIST</div><div class="v">{fbc['wallets']/census['contributors']*100:.1f} %<small>{n(fbc['wallets'])} wallets</small></div><div class="d">{fbc['points_pct']:.1f} % of all points; the peel-chain surface</div></div>
<div class="tile"><div class="l">Exchange-scale funders found</div><div class="v">{len(json.load(open(f"{S}/infra_cex_full.json"))) if os.path.exists(f"{S}/infra_cex_full.json") else 0}<small>shipped list: 12</small></div><div class="d">classified by payout volume, not by name</div></div>
</div>
<h3>Where every wallet's first ether came from</h3>
<div class="tbl"><table><thead><tr><th>first funder is…</th><th class="num">wallets</th><th class="num">share</th><th class="num">points</th></tr></thead><tbody>""")
    for k in cls_order:
        if k not in bc:
            continue
        r = bc[k]
        share = r['wallets'] / census['contributors'] * 100
        A(f"<tr><td>{html.escape(cls_label.get(k,k))}"
          f"<div class=\"meter\" style=\"max-width:220px\"><span class=\"m1\" style=\"width:{share:.1f}%\"></span></div></td>"
          f"<td class=\"num\">{n(r['wallets'])}</td>"
          f"<td class=\"num\">{share:.1f} %</td>"
          f"<td class=\"num\">{r['points_pct']:.1f} %</td></tr>")
    A("</tbody></table></div>")
    depth = {int(k): v for k, v in census["depth_hist"].items() if int(k) > 0}
    deep = max(depth) if depth else 0
    A(f"""<p>The classification is behavioural, not a vendored label list: a funder's own transaction count
says what it is. A wallet that has sent 3.7 million transactions is an exchange payout system and
sharing it is a coincidence; a wallet that has sent 200 and funded ten contributors is an operator.
That replaces the twelve hard-coded exchange addresses the shipped detector ships with, and it found
{len(json.load(open(f"{S}/infra_cex_full.json"))) if os.path.exists(f"{S}/infra_cex_full.json") else 0} exchange-scale funders in this population.</p>
<p><strong>{n(fbc['wallets'])} wallets ({fbc['wallets']/census['contributors']*100:.0f} %, {fbc['points_pct']:.1f} % of points) were funded by another wallet on the same list.</strong>
That number is not a sybil count and must never be published as one — the 2026-08-18 research measured 35 of 47
honest controls funding a second wallet from their own main wallet, which is itself a contributor. The form that
carries evidence is tighter: the funder deposited within 30 blocks, at a like amount, into a wallet that had
barely transacted{f" — {n(census['tight_peel']['wallets'])} wallets, {census['tight_peel']['points_pct']:.1f} % of points" if census.get('tight_peel') else ""}.
Those links chain: following each wallet back to its funder inside the population runs
{n(deep)} hops deep at the extreme, and the parent links fall into {n(census['component_count'])} connected
components. Depth is the thing partial coverage could not see — a chain is only visible when every link
in it is resolved, and a third of the links were missing. {n(census['depth_buckets'].get('101-1000',0) + census['depth_buckets'].get('1000+',0))} wallets
sit more than a hundred funding hops inside the population; a person funding a second wallet sits at one.
The deepest single chain is {n(deep + 1)} wallets long and deposited inside a 240-block window at jittered
amounts between 0.0775 and 0.1248 ETH, every one of them at nonce 0 — one lump of ether walked through two
thousand addresses.</p>
<h3>How fresh the wallets are</h3>
<div class="tbl"><table><thead><tr><th>nonce at the deposit</th><th class="num">wallets</th><th class="num">share</th></tr></thead><tbody>""")
    for k in ("0", "1-4", "5-19", "20-99", "100+"):
        if k in nh:
            A(f"<tr><td>nonce {html.escape(k)}{' — the deposit was the wallet\'s first ever transaction' if k=='0' else ''}</td>"
              f"<td class=\"num\">{n(nh[k])}</td><td class=\"num\">{nh[k]/nh_tot*100:.1f} %</td></tr>")
    A("</tbody></table></div>")
    if full_base or full_v2:
        fb = full_base.get("baseline(shipped)")
        fv = (full_v2.get("v2g (v2f, coverage-stable fan-out)")
              or full_v2.get("v2f (v2e + fresh hub + cex fan-out)")
              or (list(full_v2.values())[0] if full_v2 else None))
        A("""<h3>What the rules do with complete data</h3>
<div class="tbl"><table><thead><tr><th>rule set / coverage</th><th class="num">flagged</th><th class="num">points</th><th class="num">ENS flagged</th><th class="num">ring 99Ξ</th><th class="num">relay 1.10–1.14</th><th class="num">relay 1.00–1.05</th></tr></thead><tbody>""")
        def row(lbl, r, cov):
            if not r:
                return
            g = lambda k: (fw_get(r, k) or (0, 0))
            A(f"<tr><td>{html.escape(lbl)} <span class=\"chip\">{html.escape(cov)}</span></td>"
              f"<td class=\"num\">{n(r['flagged'])}</td><td class=\"num\">{r['pts']:.1f} %</td>"
              f"<td class=\"num\">{r['ens']}</td>"
              f"<td class=\"num\">{g('ring99(any')[0]}/{g('ring99(any')[1]}</td>"
              f"<td class=\"num\">{g('jitter1.10-1.14')[0]}/{g('jitter1.10-1.14')[1]}</td>"
              f"<td class=\"num\">{g('jitter1.00-1.05')[0]}/{g('jitter1.00-1.05')[1]}</td></tr>")
        row("shipped rules", base, "64 % coverage — what is published")
        row("shipped rules", fb, "100 % coverage")
        row("v2 candidate", _v2_partial, "64 % + ring/ladder")
        row("v2 candidate", fv, "100 % coverage")
        A("</tbody></table></div>")
        A("""<p><strong>Complete data does not move the shipped detector at all</strong> — same 263 clusters, same
11,573 wallets, the ≈99 ETH ring still 81/419. That is not a small result: it means the ring was never a
data gap. sybilkit's funding family is <em>folded onto</em> the behavioural clusters — an edge is drawn only
when funder and funded already sit in the same component — so a peel chain between wallets that no amount or
timing rule linked is invisible however completely it is resolved. Corroboration cannot find what nothing
proposed. The v2 candidate lets a tight peel chain <em>build</em> a component, and the same data then moves
it a long way: the 1.00–1.14 ETH serial relay goes from 450 of 841 wallets to 840 of 841.</p>
<p>Full coverage also broke one of v2's own rules, which is the more useful half of the exercise. The
exchange fan-out test asked that &ge;90 % of a funder's fresh withdrawals share one priority-fee value. At 64 %
coverage the Bitget loop sat at 97 % of its group and fired; with every contributor resolved the same 244
wallets became 78.7 % of a group that had grown to 310, and the rule went silent on a farm it used to catch
(232/232 &rarr; 0/239). The evidence had not weakened &mdash; the denominator had grown. Re-measured as an absolute
count on a fee value that is uncommon population-wide (the check its own reason string already claimed), it
returns 238/239 and no longer moves when coverage does. Any threshold written as a share of a group whose
size depends on how much data you happened to have is a bug waiting for its next sweep.</p>""")


# ---------- the in-situ benchmark against verified-honest controls ----------------
if bench:
    ship = bench.get("shipped (published)")
    ship_infra = bench.get("shipped + v2 infra")
    best = bench.get("v2h") or bench.get("v2g")
    if ship and best:
        A(f"""<h2>The measurement that matters: honest wallets, scored in place</h2>
<p>Everything above compares rule sets to each other. This compares them to <em>people</em>. The
benchmark shipped with the library scores 220 labelled wallets in isolation and reports precision 1.0,
which is hollow twice over: a control scored alone can never be pulled into a cluster by the other
19,300 wallets — the only way a false positive actually happens here — and its 60 "controls" were
sampled as <em>non-audited</em> rather than <em>verified honest</em>, so several are farm members.</p>
<p>So the controls were rebuilt against a standard <strong>written before it was applied</strong>, using
only facts about a wallet and <strong>no detector output of any kind</strong>: it had already sent 50+
transactions before this game existed; its first funder is not a contributor; it holds an ENS name; its
funder funded nobody else on the list; it funded nobody on the list; and it did not sweep to a shared
collector in the week after settlement. Applied blind to all {n(19522)} wallets that yields
<strong>{n(ship['controls'])} controls, none of them members of the independently audited farm
waves</strong> — the standard's own validation. Every wallet is then scored <em>inside</em> one run over
the whole population.</p>
<div class="tiles">
<div class="tile"><div class="l">Honest wallets the published list removes</div><div class="v">{ship['control_fp_rate']*100:.1f} %<small>{ship['controls_flagged']} of {ship['controls']}</small></div><div class="d">wallets with a costly, verifiable independent history</div></div>
<div class="tile"><div class="l">…under the v2 rules</div><div class="v">{best['control_fp_rate']*100:.1f} %<small>{best['controls_flagged']} of {best['controls']} removed</small></div><div class="d">plus {best.get('controls_in_periphery', 0)} shown for review but not removed ({best.get('control_touched_rate', 0)*100:.1f} % touched in all)</div></div>
<div class="tile"><div class="l">Farms caught</div><div class="v">{ship['farm_recall']*100:.1f} %<small>→ {best['farm_recall']*100:.1f} % under v2</small></div><div class="d">across every independently audited wave</div></div>
</div>
<p>Both error directions improve at once, which is what separates a fix from a threshold slide. The
wallets the published list removes are not marginal: <strong>wmp.eth</strong> had sent 4,907
transactions before it joined, <strong>ilnico.eth</strong> 2,004, <strong>teamhodl.eth</strong> 1,491.</p>
<p>Two things are stated here that a favourable reading would leave out. The v2 rules have a
<em>periphery</em> tier — shown as under review, never removed — and {best.get('controls_in_periphery', 0)} further
controls land there, so the fraction they <em>touch</em> at all is {best.get('control_touched_rate', 0)*100:.1f} %, not
{best['control_fp_rate']*100:.1f} %. The shipped rules have no such tier: everything they flag is removed.
And v2 is given a 612-funder exchange list derived from the data, where the shipped rules carry twelve
hard-coded addresses — so the table below also runs the shipped rules on <em>that same list</em>, which
separates "v2 has better data" from "v2 has better rules".</p>
<div class="tbl"><table><thead><tr><th>rule set · identical complete data</th><th class="num">removed from the clean list</th><th class="num">of the {n(ship['controls'])} controls</th><th class="num">shown for review</th><th class="num">farms caught</th></tr></thead><tbody>
<tr><td>shipped rules, its own 12 exchange addresses <em>(what is published)</em></td><td class="num">{n(ship['flagged_total'])}</td><td class="num">{ship['controls_flagged']} ({ship['control_fp_rate']:.1%})</td><td class="num">—</td><td class="num">{ship['farm_recall']:.1%}</td></tr>
<tr><td>shipped rules, given v2's 612-funder exchange list</td><td class="num">{n(ship_infra['flagged_total'])}</td><td class="num">{ship_infra['controls_flagged']} ({ship_infra['control_fp_rate']:.1%})</td><td class="num">—</td><td class="num">{ship_infra['farm_recall']:.1%}</td></tr>
<tr><td><strong>v2 rules</strong></td><td class="num">{n(best['flagged_total'])}</td><td class="num">{best['controls_flagged']} ({best['control_fp_rate']:.1%})</td><td class="num">{best.get('controls_in_periphery', 0)}</td><td class="num">{best['farm_recall']:.1%}</td></tr>
</tbody></table></div>
<p>Giving the published rules a better exchange list, changing nothing else, clears
{ship['controls_flagged'] - ship_infra['controls_flagged']} of the {ship['controls_flagged']} honest wallets they remove. The other
{ship_infra['controls_flagged'] - best['controls_flagged']} need the rules. Roughly one part missing data, five parts rules.</p>
<div class="callout"><strong>What this measurement cannot do.</strong> It identifies wallets carrying an
expensive independent history — not wallets certainly controlled by one human. An operator who ages and
names wallets passes every criterion, and one did: the audited 2.067 ETH wave is 324 wallets sharing a
single priority-fee value with <em>none</em> at nonce 0, and one of them holds an ENS name and satisfies
the whole standard. So the false-positive rates here are ceilings, not point estimates — the true rates
are at most this and probably lower. The standard was also amended once, on the record: its first
version admitted a wallet that v2 flagged, and v2 was right — the wallet had funded two others on the
list, and the criteria asked only where money came from, never where it went.</div>""")

A("""<h2>The v2 rule set</h2>
<div class="two">
<p><strong>Windows.</strong> Round-amount windows close after 32 blocks, not after a one-hour silence. Odd amounts reach across the population only with ≥6 decimals or a shared ≥6-digit sub-cent residual; shorter odd amounts are windowed like round ones. Near-same-block edges only join jitter amounts. The near-minimum band (≤1.25 × minimum) is exempt from identity rules, sequence and drip; burst stays.</p>
<p><strong>Funding.</strong> A tight peel chain (funder is a contributor whose deposit landed ≤30 blocks earlier with a like amount; funded wallet nonce ≤20) builds components and books its timing as cadence. A small funder fanning out ≥3 brand-new wallets that all deposit within 2 hours is a fresh hub (the 0.05 recyclers). Exchange-scale funders (vendored label lists + tx-count/balance/fan-out heuristics) count only as a fan-out: ≥10 nonce-0 wallets sharing one priority-fee value at ≥90 % (the Bitget loop; honest customers of the same exchange spread over dozens of fee values). Plain shared-funder hubs stay corroboration.</p>
<p><strong>Engines.</strong> Identical ≥3-rung deposit ladders across ≥5 wallets within 300 blocks are amount evidence; ≥20 unique ≥6-decimal amounts inside a 2 % band in one hour are amount and timing evidence. Amount rules run over each wallet's largest deposit.</p>
<p><strong>Gate.</strong> Components need ≥5 members and ≥2 families as before, but a wallet is <em>core</em> only if ≥2 families are incident on it; the rest is <em>periphery</em>: shown, never removed from the clean list. Confidence should be calibrated per member against the null model rather than noisy-OR'd.</p>
</div>
<div class="callout"><strong>What to do with the published list now.</strong> The clustermap and THE LIST clean list currently remove ~1.5–2.3 k honest small wallets (idonotknowwhatimdoing.eth with 12 IDMD, punk.austingriffith.eth, 985.eth …) and keep a single ~99 ETH operator worth 13 % of all points. Before re-publishing: (1) <s>enrich nonce + first funder for every contributor</s> — done, (2) <s>rerun with the v2 rules</s> — done, (3) render periphery as 'review' rather than 'linked' — implemented in the map's read model: a wallet held by fewer than two evidence families now shows as review rather than inheriting its group's tier, (4) open a self-attestation / appeal channel for the wallets that are named or held by weak evidence, (5) <s>rebuild the benchmark from verified-honest controls</s> — done, see above, and gate releases on the null-model false-linking rate. The prototype harness, the diagnostics, the null model and the complete enrichment that produced every number here are published at <code>github.com/banse/clustermap</code> under <code>audit/</code>, and reproduce from a clone.</div>

<h2>Method</h2>
<ul class="tight">
<li>Reproduced the live result bit-for-bit from the settled maxpane cache (263 clusters, 11,573 flagged) with a mirror combiner, then instrumented every edge by rule kind and every member by incident families.</li>
<li>Single-rule ablations, per-cluster fingerprint anatomy (nonce, fee diversity, funder structure, ENS, IDMD holdings), released-wallet diffs per variant.</li>
<li>Eleven parallel investigations (cluster 7, cluster 6, exchange hubs, small round clusters, late 0.05 waves, ENS-named flagged, odd amounts, adversarial code review, prior art, full-population recall, funder classification) with ~600 keyless Blockscout lookups; 22 skeptic passes attacked the top findings (four were narrowed and are stated in their narrowed form here) and a completeness critic swept for what nobody had examined (34 agents in total).</li>
<li>Null model: operator-free synthetic population at the observed pace, five seeds per rule set.</li>
<li>Enrichment: the ring and ladder wallets were fetched first (≈500 lookups) to measure the recall side, then the whole population — a first funder for every contributor and a transaction fingerprint for every deposit (≈23 k keyless lookups: Blockscout oldest-first for funders, batched JSON-RPC for transactions). Verified against the rows maxpane's own paginated walk had produced.</li>
</ul>
<p class="eyebrow" style="margin-top:36px">aidude · surf protocol prep · THE LIST mission · 2026-08-25</p>
</div>
""")

open(OUT, "w").write("\n".join(doc))
print("wrote", OUT, "v2 source:", v2_source, "flagged", v2["flagged"], "pts", v2["pts"], "ens", v2["ens"], "idmd", v2["idmd"])
