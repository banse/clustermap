"""FastAPI routes. All analytical work remains in the model layer."""

from __future__ import annotations

import json
import re
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request
from fastapi.responses import Response

ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")

router = APIRouter(prefix="/api/v1")


def _repository(request: Request):
    return request.app.state.repository


def _versioned(call):
    try:
        return call()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc


def _list_versioned(call):
    try:
        return _versioned(call)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/health")
def health(request: Request) -> dict:
    return _repository(request).health()


@router.get("/review")
def review(
    request: Request,
    version: Annotated[str | None, Query(max_length=80)] = None,
) -> dict:
    return _versioned(lambda: _repository(request).review(version))


@router.get("/versions")
def versions(request: Request) -> dict:
    return _repository(request).versions()


@router.get("/versions/{version_id}")
def version(request: Request, version_id: str) -> dict:
    return _versioned(lambda: _repository(request).version(version_id))


@router.get("/changelog")
def changelog(
    request: Request,
    kind: Literal["chain", "analysis", "publication", "context"] | None = None,
    from_at: Annotated[str | None, Query(alias="from", max_length=40)] = None,
    to_at: Annotated[str | None, Query(alias="to", max_length=40)] = None,
) -> dict:
    return _repository(request).changelog(kind=kind, from_at=from_at, to_at=to_at)


@router.get("/delta")
def delta(
    request: Request,
    base: Annotated[str, Query(max_length=80)],
    head: Annotated[str, Query(max_length=80)],
) -> dict:
    return _versioned(lambda: _repository(request).delta(base, head))


@router.get("/delta/wallets")
def delta_wallets(
    request: Request,
    base: Annotated[str, Query(max_length=80)],
    head: Annotated[str, Query(max_length=80)],
    delta_class: Annotated[
        Literal["improved", "worsened", "under_review", "unchanged"] | None,
        Query(alias="class"),
    ] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict:
    return _versioned(
        lambda: _repository(request).delta_wallets(
            base,
            head,
            delta_filter=delta_class,
            offset=offset,
            limit=limit,
        )
    )


@router.get("/overview")
def overview(
    request: Request,
    version: Annotated[str | None, Query(max_length=80)] = None,
) -> dict:
    return _versioned(lambda: _repository(request).overview(version))


@router.get("/stats")
def stats(
    request: Request,
    version: Annotated[str | None, Query(max_length=80)] = None,
) -> dict:
    return _versioned(lambda: _repository(request).stats(version))


@router.get("/map/global")
def global_map(
    request: Request,
    version: Annotated[str | None, Query(max_length=80)] = None,
) -> dict:
    return _versioned(lambda: _repository(request).global_map(version))


@router.get("/clusters/{cluster_id}")
def cluster(
    request: Request,
    cluster_id: Annotated[int, Path(ge=0)],
    version: Annotated[str | None, Query(max_length=80)] = None,
) -> dict:
    value = _versioned(lambda: _repository(request).cluster(cluster_id, version))
    if value is None:
        raise HTTPException(status_code=404, detail="cluster not found")
    return value


@router.get("/wallets/{address}")
def wallet(
    request: Request,
    address: str,
    version: Annotated[str | None, Query(max_length=80)] = None,
) -> dict:
    if not ADDRESS_RE.fullmatch(address):
        raise HTTPException(status_code=422, detail="invalid Ethereum address")
    value = _versioned(lambda: _repository(request).wallet(address, version))
    if value is None:
        raise HTTPException(status_code=404, detail="wallet is not in the original list")
    return value


@router.get("/list")
def original_list(
    request: Request,
    version: Annotated[str | None, Query(max_length=80)] = None,
    q: Annotated[str, Query(max_length=80)] = "",
    link: Literal["selected", "all", "linked", "unlinked", "retained"] = "selected",
    evidence: Literal["all", "high", "low"] = "all",
    preset: Literal["none", "first1000", "hour0", "whale", "ens"] = "none",
    sort: Literal[
        "rank",
        "wallet",
        "points",
        "credit",
        "weight",
        "deposits",
        "gross",
        "range",
        "window",
    ] = "rank",
    direction: Literal["asc", "desc"] = "asc",
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict:
    return _list_versioned(
        lambda: _repository(request).list_rows(
            version_id=version,
            query=q,
            link=link,
            evidence=evidence,
            preset=preset,
            sort=sort,
            direction=direction,
            offset=offset,
            limit=limit,
        )
    )


@router.get("/list/export")
def export_original_list(
    request: Request,
    version: Annotated[str | None, Query(max_length=80)] = None,
    q: Annotated[str, Query(max_length=80)] = "",
    link: Literal["selected", "all", "linked", "unlinked", "retained"] = "selected",
    evidence: Literal["all", "high", "low"] = "all",
    preset: Literal["none", "first1000", "hour0", "whale", "ens"] = "none",
    sort: Literal[
        "rank",
        "wallet",
        "points",
        "credit",
        "weight",
        "deposits",
        "gross",
        "range",
        "window",
    ] = "rank",
    direction: Literal["asc", "desc"] = "asc",
) -> Response:
    payload = _list_versioned(
        lambda: _repository(request).export_rows(
            version_id=version,
            query=q,
            link=link,
            evidence=evidence,
            preset=preset,
            sort=sort,
            direction=direction,
        )
    )
    suffix = preset if preset != "none" else "current"
    version_suffix = payload["analysis_version"]["id"]
    return Response(
        content=json.dumps(payload, separators=(",", ":")),
        media_type="application/json",
        headers={
            "Content-Disposition": (
                f'attachment; filename="the-list-{version_suffix}-{suffix}.json"'
            )
        },
    )
