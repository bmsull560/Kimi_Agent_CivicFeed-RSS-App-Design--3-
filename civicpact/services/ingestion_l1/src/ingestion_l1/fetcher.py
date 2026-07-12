"""Async feed fetcher with SSRF protection and bounded resource limits."""

from __future__ import annotations

import httpx
from value_fabric.shared.errors import RSSIngestionError, SecurityError
from value_fabric.shared.security import UnsafeUrlError, validate_url

# 10 MiB cap on response body size.
_MAX_BODY_BYTES = 10 * 1024 * 1024


def _build_client() -> httpx.AsyncClient:
    """Return a preconfigured ``httpx.AsyncClient``.

    The client enforces connection, read, and redirect limits to prevent
    runaway requests.
    """
    limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
    return httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
        follow_redirects=True,
        limits=limits,
        max_redirects=5,
    )


async def fetch_feed(
    feed_url: str,
    feed_id: str,
    *,
    extra_headers: dict[str, str] | None = None,
) -> bytes:
    """Fetch a feed URL safely and return the raw response body.

    Args:
        feed_url: The URL of the RSS/Atom feed.
        feed_id: Logical identifier used for diagnostics.
        extra_headers: Optional additional request headers.

    Returns:
        Raw response body bytes.

    Raises:
        SecurityError: If the URL fails SSRF validation.
        RSSIngestionError: If the HTTP request fails, redirects too many times,
            or the response body exceeds size limits.
    """
    try:
        validate_url(feed_url)
    except UnsafeUrlError as err:
        raise SecurityError(
            error_code="CF-001-002",
            message="Feed URL failed security validation.",
            context_details={"feed_id": feed_id, "url": feed_url},
        ) from err

    headers = {
        "User-Agent": (
            "CivicPact-L1-Ingestion/0.1 "
            "(+https://github.com/civicpact/ingestion)"
        ),
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    }
    if extra_headers:
        headers.update(extra_headers)

    client = _build_client()
    try:
        response = await client.get(feed_url, headers=headers)
        response.raise_for_status()

        content_length = response.headers.get("content-length")
        if content_length is not None and int(content_length) > _MAX_BODY_BYTES:
            raise RSSIngestionError(
                error_code="CF-101-001",
                message="Feed response body exceeds maximum allowed size.",
                context_details={
                    "feed_id": feed_id,
                    "url": feed_url,
                    "content_length": content_length,
                },
            )

        body = await response.aread()
        if len(body) > _MAX_BODY_BYTES:
            raise RSSIngestionError(
                error_code="CF-101-002",
                message="Feed response body exceeds maximum allowed size.",
                context_details={
                    "feed_id": feed_id,
                    "url": feed_url,
                    "body_size": len(body),
                },
            )

        return body

    except httpx.HTTPStatusError as err:
        raise RSSIngestionError(
            error_code="CF-101-003",
            message=f"Feed returned HTTP {err.response.status_code}.",
            context_details={
                "feed_id": feed_id,
                "url": feed_url,
                "status_code": err.response.status_code,
            },
        ) from err
    except httpx.RequestError as err:
        raise RSSIngestionError(
            error_code="CF-101-004",
            message="Feed request failed.",
            context_details={
                "feed_id": feed_id,
                "url": feed_url,
                "exception_type": type(err).__name__,
            },
        ) from err
    finally:
        await client.aclose()


def extract_feed_links(html_text: str, base_url: str) -> list[str]:
    """Discover RSS/Atom feed URLs from an HTML page.

    This is a lightweight, deterministic discovery helper that does not perform
    any outbound requests.

    Args:
        html_text: The HTML body of a web page.
        base_url: Base URL used to resolve relative feed links.

    Returns:
        List of absolute feed URLs discovered in the HTML.
    """
    from urllib.parse import urljoin

    links: list[str] = []
    # Match <link rel="alternate" type="application/rss+xml" href="...">
    # and Atom variants.
    import re

    pattern = re.compile(
        r'<link[^\u003e]*rel=["\']alternate["\'][^\u003e]*'
        r'type=["\'](application/rss\+xml|application/atom\+xml)["\'][^\u003e]*'
        r'href=["\']([^"\']+)["\']',
        re.IGNORECASE,
    )
    for match in pattern.finditer(html_text):
        href = match.group(3)
        links.append(urljoin(base_url, href))

    return links
