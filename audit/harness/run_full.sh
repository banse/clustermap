#!/usr/bin/env bash
# desc: rebuild every full-coverage artifact from the enrichment checkpoints (census, funder classes, detector reruns, report)
set -euo pipefail
cd "$(dirname "$0")"
DATA="${SYBIL_DATA:-$(cd ../../data/sybil && pwd)}"
ENR="$DATA/enrichment"

echo "== merge checkpoints =="
python3 fetch_all_enrich.py --merge-only

echo "== classify every funder =="
python3 funder_profile.py | tee "$DATA/runs/funder_profile.log" | tail -20

echo "== population census =="
python3 full_census.py | tee "$DATA/runs/full_census.log" | tail -30

EX="$ENR/full_enrich.json;$ENR/ring_enrich.json;$ENR/ladder_enrich.json"
echo "== shipped rules on complete data =="
python3 sk_v2.py --enrich-extra "$EX" --only "baseline(shipped)" | tee "$DATA/v2_full_base.log" | tail -4

echo "== v2 on complete data (funder classes as the infra gate) =="
python3 sk_v2.py --enrich-extra "$EX" --infra "$DATA/infra_all.json" \
  --only "v2g (v2f, coverage-stable fan-out)" | tee "$DATA/v2_full.log" | tail -4

if [ "${1:-}" = "--with-null" ]; then
  echo "== null model at production coverage (~15 min) =="
  python3 null_model.py --enrich-extra "$EX" | tee "$DATA/runs/null_full.log" | tail -12
fi

echo "== report =="
python3 build_report.py
