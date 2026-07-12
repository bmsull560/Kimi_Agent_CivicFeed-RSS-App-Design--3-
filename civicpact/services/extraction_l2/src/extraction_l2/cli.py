"""Command-line interface for Layer 2 entity extraction."""

from __future__ import annotations

import argparse
import asyncio
import json
import os

from ingestion_l1.fetcher import fetch_feed
from ingestion_l1.parser import parse_feed

from extraction_l2.engine import ExtractionEngine
from extraction_l2.llm_client import OpenAICompatibleClient


def _build_arg_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        prog="extract",
        description="Extract civic entities from an RSS/Atom feed URL.",
    )
    parser.add_argument("feed_url", help="URL of the RSS/Atom feed.")
    parser.add_argument("--feed-id", default="cli-feed", help="Logical feed ID.")
    parser.add_argument(
        "--base-url",
        default=os.getenv("LLM_BASE_URL", "http://localhost:11434"),
        help="OpenAI-compatible LLM base URL.",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("LLM_API_KEY", ""),
        help="LLM API key.",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("LLM_MODEL", "llama3"),
        help="Model identifier.",
    )
    return parser


async def _run(
    feed_url: str,
    feed_id: str,
    base_url: str,
    api_key: str,
    model: str,
) -> None:
    """Fetch a feed, parse it, and extract entities from the first item."""
    raw_body = await fetch_feed(feed_url, feed_id)
    items = parse_feed(raw_body, feed_id)
    if not items:
        raise RuntimeError("No feed items found.")

    llm_client = OpenAICompatibleClient(base_url=base_url, api_key=api_key, model=model)
    engine = ExtractionEngine(llm_client)
    result = await engine.extract(items[0])
    print(json.dumps(result.model_dump(mode="json"), indent=2))


def main() -> None:
    """Entry point for the extraction CLI."""
    parser = _build_arg_parser()
    args = parser.parse_args()
    asyncio.run(
        _run(
            args.feed_url,
            args.feed_id,
            args.base_url,
            args.api_key,
            args.model,
        )
    )


if __name__ == "__main__":
    main()
