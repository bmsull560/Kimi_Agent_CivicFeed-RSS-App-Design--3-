"""Playwright-based headless scraper stub for JavaScript-rendered feeds."""

from __future__ import annotations

from value_fabric.shared.errors import RSSIngestionError
from value_fabric.shared.security import validate_url


class PlaywrightScraper:
    """Stub headless browser scraper for pages that require JavaScript.

    This implementation validates the URL and returns a deterministic error
    indicating that full Playwright rendering is not yet enabled. It preserves
    the layer boundary so downstream code can depend on the scraper interface.

    Args:
        browser_name: Browser engine to use when rendering (default ``chromium``).
    """

    def __init__(self, browser_name: str = "chromium") -> None:
        """Initialize the scraper stub.

        Args:
            browser_name: Target browser engine.
        """
        self._browser_name = browser_name

    async def fetch_page_html(self, url: str) -> str:
        """Return the rendered HTML of a page.

        Args:
            url: The URL to render.

        Returns:
            Rendered HTML as a string.

        Raises:
            RSSIngestionError: Full Playwright rendering is not implemented yet.
        """
        validate_url(url)
        raise RSSIngestionError(
            error_code="CF-103-001",
            message=(
                "Playwright headless rendering is not enabled in this phase. "
                "Use the direct HTTP fetcher for static RSS/Atom feeds."
            ),
            context_details={"url": url, "browser": self._browser_name},
        )
