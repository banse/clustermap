.PHONY: install build test run snapshot

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
