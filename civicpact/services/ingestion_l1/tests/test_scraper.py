"""Tests for the Playwright scraper stub."""

from __future__ import annotations

import pytest
from ingestion_l1.scraper import PlaywrightScraper
from value_fabric.shared.errors import RSSIngestionError
from value_fabric.shared.security import UnsafeUrlError


@pytest.mark.asyncio
async def test_scraper_validates_url() -> None:
    """The scraper rejects unsafe URLs before rendering."""
    scraper = PlaywrightScraper()
    with pytest.raises(UnsafeUrlError):
        await scraper.fetch_page_html("http://localhost/private")


@pytest.mark.asyncio
async def test_scraper_stub_raises_not_implemented() -> None:
    """Safe URLs raise the expected not-enabled error."""
    scraper = PlaywrightScraper()
    with pytest.raises(RSSIngestionError):
        await scraper.fetch_page_html("https://example.com")
