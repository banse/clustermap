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


@router.get("/health")
def health(request: Request) -> dict:
    return _repository(request).health()


@router.get("/overview")
def overview(request: Request) -> dict:
    return _repository(request).overview()


@router.get("/map/global")
def global_map(request: Request) -> dict:
    return _repository(request).global_map()


@router.get("/clusters/{cluster_id}")
def cluster(
    request: Request,
    cluster_id: Annotated[int, Path(ge=0)],
) -> dict:
    value = _repository(request).cluster(cluster_id)
    if value is None:
        raise HTTPException(status_code=404, detail="cluster not found")
    return value


@router.get("/wallets/{address}")
def wallet(request: Request, address: str) -> dict:
    if not ADDRESS_RE.fullmatch(address):
        raise HTTPException(status_code=422, detail="invalid Ethereum address")
    value = _repository(request).wallet(address)
    if value is None:
        raise HTTPException(status_code=404, detail="wallet is not in the original list")
    return value


@router.get("/list")
def original_list(
    request: Request,
    q: Annotated[str, Query(max_length=80)] = "",
    link: Literal["all", "linked", "unlinked"] = "all",
    evidence: Literal["all", "high", "low"] = "all",
    preset: Literal["none", "first1000", "hour0", "whale"] = "none",
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict:
    return _repository(request).list_rows(
        query=q,
        link=link,
        evidence=evidence,
        preset=preset,
        offset=offset,
        limit=limit,
    )


@router.get("/list/export")
def export_original_list(
    request: Request,
    q: Annotated[str, Query(max_length=80)] = "",
    link: Literal["all", "linked", "unlinked"] = "all",
    evidence: Literal["all", "high", "low"] = "all",
    preset: Literal["none", "first1000", "hour0", "whale"] = "none",
) -> Response:
    payload = _repository(request).export_rows(
        query=q,
        link=link,
        evidence=evidence,
        preset=preset,
    )
    suffix = preset if preset != "none" else "current"
    return Response(
        content=json.dumps(payload, separators=(",", ":")),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="the-list-{suffix}.json"'},
    )
