.PHONY: install build test run snapshot versions nft-holder-snapshot quality-stats

install:
	uv sync --all-groups
	npm --prefix dashboard install

build:
	npm --prefix dashboard run build

test:
	uv run pytest -q
	uv run ruff check src tests scripts
	npm --prefix dashboard test
	npm --prefix dashboard run typecheck
	npm --prefix dashboard run build

run:
	uv run clustermap

snapshot:
	uv run python scripts/export_snapshot.py

versions:
	uv run python scripts/build_versions.py

nft-holder-snapshot:
	uv run python scripts/build_nft_holder_snapshot.py

quality-stats:
	uv run python scripts/build_quality_stats.py
