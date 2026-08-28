#!/usr/bin/env python3
"""Build a fixed-block NFT-holder snapshot for THE LIST.

This is an offline provenance step, never a runtime dependency. Set
``CLUSTERMAP_NFT_RPC_URL`` to an Ethereum JSON-RPC endpoint; the URL is used for
the crawl but is deliberately not written to the artifact because it may
contain a secret token.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = PROJECT_ROOT / "data" / "curator_snapshot.json.gz"
OUTPUT = PROJECT_ROOT / "data" / "nft_holder_snapshot.json.gz"
BALANCE_OF = "70a08231"
MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11"
AGGREGATE3 = "82ad56cb"

COLLECTIONS = (
    ("cryptopunks", "CryptoPunks", "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb"),
    ("bayc", "Bored Ape Yacht Club", "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"),
    ("mayc", "Mutant Ape Yacht Club", "0x60e4d786628fea6478f785a6d7e704777c86a7c6"),
    ("azuki", "Azuki", "0xed5af388653567af2f388e6224dc7c4b3241c544"),
    ("pudgy", "Pudgy Penguins", "0xbd3531da5cf5857e7cfaa92426877b022e612cf8"),
    ("doodles", "Doodles", "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e"),
    ("moonbirds", "Moonbirds", "0x23581767a106ae21c074b2276d25e5c3e136a68b"),
    ("milady", "Milady Maker", "0x5af0d9827e0c53e4799bb226655a1de152a425a5"),
)


class RpcError(RuntimeError):
    pass


def read_json_rpc(url: str, payload: dict | list, *, retries: int = 6):
    body = json.dumps(payload, separators=(",", ":")).encode()
    for attempt in range(retries):
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "clustermap-quality-snapshot/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                value = json.load(response)
        except (TimeoutError, urllib.error.URLError, json.JSONDecodeError) as exc:
            if attempt + 1 == retries:
                raise RpcError(f"RPC request failed after {retries} attempts") from exc
            time.sleep(2**attempt)
            continue
        rows = value if isinstance(value, list) else [value]
        if any("error" in row for row in rows):
            messages = [row["error"].get("message", "RPC error") for row in rows if "error" in row]
            rate_limited = any("rate limit" in message.lower() for message in messages)
            if rate_limited and attempt + 1 < retries:
                time.sleep(2**attempt)
                continue
            raise RpcError("; ".join(sorted(set(messages))))
        return value
    raise AssertionError("unreachable")


def rpc_value(url: str, method: str, params: list):
    response = read_json_rpc(
        url,
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
    )
    return response["result"]


def load_population() -> tuple[list[str], int]:
    with gzip.open(SNAPSHOT, "rt", encoding="utf-8") as handle:
        snapshot = json.load(handle)
    addresses = sorted(row["address"].lower() for row in snapshot["raw_list"])
    return addresses, int(snapshot["meta"]["snapshot_block"])


def balance_call(address: str) -> str:
    return f"0x{BALANCE_OF}{address.removeprefix('0x').rjust(64, '0')}"


def _word(value: int) -> bytes:
    return value.to_bytes(32, "big")


def _aggregate3_calldata(calls: list[tuple[str, str]]) -> str:
    """Encode Multicall3.aggregate3 without adding a runtime ABI dependency."""
    tuples = []
    for target, calldata in calls:
        raw_calldata = bytes.fromhex(calldata.removeprefix("0x"))
        padded = raw_calldata.ljust(((len(raw_calldata) + 31) // 32) * 32, b"\0")
        tuples.append(
            bytes.fromhex(target.removeprefix("0x")).rjust(32, b"\0")
            + _word(1)  # allowFailure; failures are checked after decoding
            + _word(96)
            + _word(len(raw_calldata))
            + padded
        )
    cursor = 32 * len(tuples)
    offsets = []
    for row in tuples:
        offsets.append(_word(cursor))
        cursor += len(row)
    encoded = _word(32) + _word(len(tuples)) + b"".join(offsets) + b"".join(tuples)
    return f"0x{AGGREGATE3}{encoded.hex()}"


def _decode_aggregate3(value: str) -> list[tuple[bool, bytes]]:
    raw = bytes.fromhex(value.removeprefix("0x"))
    array_offset = int.from_bytes(raw[:32], "big")
    length = int.from_bytes(raw[array_offset : array_offset + 32], "big")
    offsets_start = array_offset + 32
    decoded = []
    for index in range(length):
        tuple_offset = int.from_bytes(
            raw[offsets_start + 32 * index : offsets_start + 32 * (index + 1)],
            "big",
        )
        tuple_start = offsets_start + tuple_offset
        success = bool(int.from_bytes(raw[tuple_start : tuple_start + 32], "big"))
        data_offset = int.from_bytes(raw[tuple_start + 32 : tuple_start + 64], "big")
        data_start = tuple_start + data_offset
        data_length = int.from_bytes(raw[data_start : data_start + 32], "big")
        return_data = raw[data_start + 32 : data_start + 32 + data_length]
        decoded.append((success, return_data))
    return decoded


def benchmark_holders(
    url: str,
    addresses: list[str],
    block: str,
    batch_size: int,
) -> dict[str, list[str]]:
    holders = {collection_id: [] for collection_id, _, _ in COLLECTIONS}
    for offset in range(0, len(addresses), batch_size):
        batch = addresses[offset : offset + batch_size]
        calls = [
            (contract, balance_call(address))
            for address in batch
            for _, _, contract in COLLECTIONS
        ]
        response = rpc_value(
            url,
            "eth_call",
            [{"to": MULTICALL3, "data": _aggregate3_calldata(calls)}, block],
        )
        decoded = _decode_aggregate3(response)
        if len(decoded) != len(calls):
            raise RpcError("Multicall response did not cover every balance")
        for call_index, (success, return_data) in enumerate(decoded):
            if not success or len(return_data) != 32:
                raise RpcError("an ERC-721 balanceOf call failed")
            if int.from_bytes(return_data, "big") == 0:
                continue
            address_index, collection_index = divmod(call_index, len(COLLECTIONS))
            holders[COLLECTIONS[collection_index][0]].append(batch[address_index])
        completed = min(offset + len(batch), len(addresses))
        print(f"read {completed:,}/{len(addresses):,} wallets", flush=True)
    return holders


def write_gzip_json(path: Path, payload: dict) -> None:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as handle:
            handle.write(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--block", help="hex or decimal block; defaults to the RPC head")
    parser.add_argument("--batch-size", type=int, default=250)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 500:
        parser.error("--batch-size must be between 1 and 500")
    rpc_url = os.environ.get("CLUSTERMAP_NFT_RPC_URL")
    if not rpc_url:
        parser.error("set CLUSTERMAP_NFT_RPC_URL to an Ethereum JSON-RPC endpoint")

    addresses, list_snapshot_block = load_population()
    if args.block is None:
        observed_block = int(rpc_value(rpc_url, "eth_blockNumber", []), 16)
    else:
        observed_block = int(args.block, 0)
    block_hex = hex(observed_block)
    block_row = rpc_value(rpc_url, "eth_getBlockByNumber", [block_hex, False])
    if block_row is None:
        raise RpcError(f"block {observed_block:,} was not available from the RPC")
    observed_at = datetime.fromtimestamp(int(block_row["timestamp"], 16), tz=UTC)

    code_payload = [
        {"jsonrpc": "2.0", "id": index, "method": "eth_getCode", "params": [contract, block_hex]}
        for index, (_, _, contract) in enumerate(COLLECTIONS)
    ]
    code_rows = read_json_rpc(rpc_url, code_payload)
    if any(row["result"] == "0x" for row in code_rows):
        raise RpcError("at least one collection contract had no code at the observation block")

    holder_sets = benchmark_holders(
        rpc_url,
        addresses,
        block_hex,
        args.batch_size,
    )
    collections = []
    for collection_id, name, contract in COLLECTIONS:
        holders = holder_sets[collection_id]
        collections.append(
            {
                "id": collection_id,
                "name": name,
                "contract": contract,
                "explorer_url": f"https://etherscan.io/token/{contract}",
                "holders_in_population": holders,
            }
        )
        print(f"{name}: {len(holders):,} holders in THE LIST")

    payload = {
        "schema_version": 1,
        "benchmark": "Fixed Ethereum blue-chip PFP benchmark",
        "method": "ERC-721 balanceOf(address) > 0",
        "list_snapshot_block": list_snapshot_block,
        "observed_block": observed_block,
        "observed_at": observed_at.isoformat().replace("+00:00", "Z"),
        "population": len(addresses),
        "collections": collections,
    }
    write_gzip_json(args.output, payload)
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
