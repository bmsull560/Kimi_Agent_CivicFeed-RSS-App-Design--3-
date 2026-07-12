"""RSS/Atom feed parser producing standardized Pydantic models."""

from __future__ import annotations

import datetime
from typing import Any, cast

import feedparser
from pydantic import HttpUrl
from value_fabric.shared.errors import RSSIngestionError

from ingestion_l1.models import RSSFeedItem


def _parse_date_struct(date_struct: Any) -> datetime.datetime:
    """Convert a feedparser date tuple to a UTC datetime.

    Args:
        date_struct: The ``published_parsed`` or ``updated_parsed`` tuple.

    Returns:
        A timezone-aware UTC datetime.

    Raises:
        RSSIngestionError: If the date cannot be parsed.
    """
    if date_struct is None:
        return datetime.datetime.now(datetime.UTC)

    try:
        return datetime.datetime(
            date_struct[0],
            date_struct[1],
            date_struct[2],
            date_struct[3],
            date_struct[4],
            date_struct[5],
            tzinfo=datetime.UTC,
        )
    except (TypeError, ValueError, IndexError) as err:
        raise RSSIngestionError(
            error_code="CF-102-001",
            message="Feed item contains an unparseable publication date.",
            context_details={"date_struct": str(date_struct)},
        ) from err


def _extract_content(entry: Any) -> str:
    """Return the best available content string from a feedparser entry.

    Prefers ``content:encoded`` / ``content`` elements, then ``summary`` /
    ``description``, then ``title`` as a last resort.
    """
    content = ""
    if hasattr(entry, "content") and entry.content:
        content = entry.content[0].value
    elif getattr(entry, "summary", ""):
        content = entry.summary
    elif getattr(entry, "description", ""):
        content = entry.description
    elif getattr(entry, "title", ""):
        content = entry.title
    return content or ""


def parse_feed(raw_body: bytes, feed_id: str) -> list[RSSFeedItem]:
    """Parse raw RSS/Atom bytes into a list of ``RSSFeedItem`` models.

    Args:
        raw_body: Raw feed XML bytes.
        feed_id: Logical identifier of the feed source.

    Returns:
        List of validated feed items.

    Raises:
        RSSIngestionError: If parsing fails or no usable entries are found.
    """
    try:
        parsed = feedparser.parse(raw_body)
    except Exception as err:
        raise RSSIngestionError(
            error_code="CF-102-002",
            message="Feed XML could not be parsed.",
            context_details={"feed_id": feed_id, "exception_type": type(err).__name__},
        ) from err

    if parsed.bozo and parsed.bozo_exception is not None and not parsed.entries:
        raise RSSIngestionError(
            error_code="CF-102-003",
            message="Feed is malformed and contains no parseable entries.",
            context_details={
                "feed_id": feed_id,
                "parse_error": type(parsed.bozo_exception).__name__,
            },
        )

    items: list[RSSFeedItem] = []
    for entry in parsed.entries:
        title = getattr(entry, "title", "").strip()
        link = getattr(entry, "link", "") or ""
        if not link:
            # Some feeds use id as a permalink.
            link = getattr(entry, "id", "")

        if not title and not link:
            continue

        pub_date = _parse_date_struct(
            getattr(entry, "published_parsed", None)
            or getattr(entry, "updated_parsed", None)
        )

        entry_id = getattr(entry, "id", "") or link or f"{feed_id}:{title}:{pub_date.isoformat()}"

        try:
            item = RSSFeedItem(
                id=entry_id,
                feed_id=feed_id,
                title=title or "Untitled",
                source_url=cast(HttpUrl, str(link)),
                publication_date=pub_date,
                raw_content=_extract_content(entry),
                author=getattr(entry, "author", None),
            )
        except ValueError as err:
            raise RSSIngestionError(
                error_code="CF-102-004",
                message="Feed item failed schema validation.",
                context_details={"feed_id": feed_id, "error": str(err)},
            ) from err

        items.append(item)

    if not items:
        raise RSSIngestionError(
            error_code="CF-102-005",
            message="Feed contains no usable entries.",
            context_details={"feed_id": feed_id},
        )

    return items
