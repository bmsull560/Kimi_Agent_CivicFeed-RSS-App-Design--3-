"""Tests for Layer 1 feed parsing."""

from __future__ import annotations

import datetime

import pytest
from ingestion_l1.parser import parse_feed
from value_fabric.shared.errors import RSSIngestionError

_EXPECTED_YEAR = 2026

_SAMPLE_RSS = b"""\
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item>
      <title>First Entry</title>
      <link>https://example.com/first</link>
      <description>First entry body.</description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <author>author@example.com</author>
    </item>
  </channel>
</rss>
"""

_SAMPLE_ATOM = b"""\
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom-entry" />
    <summary>Atom entry summary.</summary>
    <updated>2026-06-15T12:00:00Z</updated>
  </entry>
</feed>
"""


def test_parse_rss_feed() -> None:
    """RSS 2.0 feed is parsed into RSSFeedItem models."""
    items = parse_feed(_SAMPLE_RSS, "feed-001")

    assert len(items) == 1
    item = items[0]
    assert item.feed_id == "feed-001"
    assert item.title == "First Entry"
    assert str(item.source_url) == "https://example.com/first"
    assert item.publication_date.year == _EXPECTED_YEAR
    assert item.author == "author@example.com"


def test_parse_atom_feed() -> None:
    """Atom feed is parsed into RSSFeedItem models."""
    items = parse_feed(_SAMPLE_ATOM, "feed-002")

    assert len(items) == 1
    item = items[0]
    assert item.title == "Atom Entry"
    assert str(item.source_url) == "https://example.com/atom-entry"
    assert item.publication_date.tzinfo == datetime.UTC


def test_parse_empty_feed_raises() -> None:
    """A feed with no usable entries raises RSSIngestionError."""
    body = b"""<?xml version="1.0"?><rss><channel></title></channel></rss>"""
    with pytest.raises(RSSIngestionError):
        parse_feed(body, "feed-empty")
