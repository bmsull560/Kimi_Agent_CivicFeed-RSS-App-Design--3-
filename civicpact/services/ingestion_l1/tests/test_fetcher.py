"""Tests for Layer 1 feed fetching."""

from __future__ import annotations

import pytest
import respx
from httpx import Response
from ingestion_l1.fetcher import fetch_feed
from value_fabric.shared.errors import RSSIngestionError, SecurityError


@pytest.mark.asyncio
async def test_fetch_feed_success() -> None:
    """A valid feed URL returns the response body."""
    feed_url = "https://example.com/rss.xml"
    feed_body = b"<?xml version='1.0'?><rss><channel></title></channel></rss>"

    with respx.mock:
        respx.get(feed_url).mock(return_value=Response(200, content=feed_body))
        result = await fetch_feed(feed_url, "feed-001")

    assert result == feed_body


@pytest.mark.asyncio
async def test_fetch_feed_blocks_private_url() -> None:
    """Private URLs are rejected before any network request."""
    with pytest.raises(SecurityError):
        await fetch_feed("http://localhost/rss.xml", "feed-001")


@pytest.mark.asyncio
async def test_fetch_feed_raises_on_http_error() -> None:
    """HTTP errors are mapped to RSSIngestionError."""
    feed_url = "https://example.com/rss.xml"

    with respx.mock:
        respx.get(feed_url).mock(return_value=Response(500))
        with pytest.raises(RSSIngestionError):
            await fetch_feed(feed_url, "feed-001")
