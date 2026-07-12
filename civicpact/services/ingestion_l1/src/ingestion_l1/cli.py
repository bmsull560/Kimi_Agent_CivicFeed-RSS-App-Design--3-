"""Command-line interface for Layer 1 ingestion."""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid

from value_fabric.shared.context import TenantContext

from ingestion_l1.fetcher import fetch_feed
from ingestion_l1.parser import parse_feed


def _build_arg_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        prog="ingest",
        description="Fetch and parse an RSS/Atom feed for CivicPact Layer 1.",
    )
    parser.add_argument("feed_url", help="URL of the RSS/Atom feed.")
    parser.add_argument("--feed-id", default="cli-feed", help="Logical feed ID.")
    parser.add_argument(
        "--tenant-id",
        default=str(uuid.uuid4()),
        help="Tenant UUID (default: random).",
    )
    return parser


async def _run(feed_url: str, feed_id: str, tenant_id: uuid.UUID) -> None:
    """Run ingestion inside a tenant context and print JSON output."""
    async with TenantContext(tenant_id):
        raw_body = await fetch_feed(feed_url, feed_id)
        items = parse_feed(raw_body, feed_id)
        print(json.dumps([item.model_dump_safe() for item in items], indent=2))


def main() -> None:
    """Entry point for the ingestion CLI."""
    parser = _build_arg_parser()
    args = parser.parse_args()
    tenant_id = uuid.UUID(args.tenant_id)
    asyncio.run(_run(args.feed_url, args.feed_id, tenant_id))


if __name__ == "__main__":
    main()
