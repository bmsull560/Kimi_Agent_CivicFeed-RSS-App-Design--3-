"""Tests for URL validation and SSRF protection."""

from __future__ import annotations

import pytest

from value_fabric.shared.security import UnsafeUrlError, validate_url


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/rss.xml",
        "http://feeds.example.org/news.atom",
        "https://www.congress.gov/rss/bills.xml",
    ],
)
def test_validate_url_accepts_safe_urls(url: str) -> None:
    """Public HTTP/HTTPS URLs should be accepted."""
    assert validate_url(url) == url


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/feed.xml",
        "http://127.0.0.1/rss",
        "http://10.0.0.1/atom",
        "http://192.168.1.1/rss.xml",
        "http://172.16.0.1/feed",
        "http://169.254.169.254/latest/meta-data/",
        "http://0.0.0.0/feed",
        "http://[::1]/rss",
        "ftp://example.com/rss.xml",
        "http:///rss.xml",
    ],
)
def test_validate_url_rejects_unsafe_urls(url: str) -> None:
    """Private, loopback, link-local, metadata, and non-HTTP URLs must be blocked."""
    with pytest.raises(UnsafeUrlError):
        validate_url(url)
