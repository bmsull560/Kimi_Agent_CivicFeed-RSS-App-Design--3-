"""Pydantic models for Layer 1 ingestion outputs."""

from __future__ import annotations

import datetime
from typing import Any

from pydantic import BaseModel, Field, HttpUrl, field_validator


class RSSFeedItem(BaseModel):
    """Standardized schema for a single RSS or Atom feed entry.

    Args:
        feed_id: Unique identifier of the originating RSS stream.
        title: Cleaned title of the entry.
        source_url: Canonical URL of the article or item.
        publication_date: Standardized UTC timestamp.
        raw_content: Raw HTML or text body of the item.
        author: Optional reported author.
    """

    id: str = Field(
        ...,
        description="Stable identifier for this feed entry.",
    )
    feed_id: str = Field(
        ...,
        description="Unique alphanumeric identifier of the originating RSS stream.",
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Cleaned title of the RSS entry.",
    )
    source_url: HttpUrl = Field(
        ...,
        description="Canonical source URL of the article link.",
    )
    publication_date: datetime.datetime = Field(
        ...,
        description="Standardized UTC timestamp of publication.",
    )
    raw_content: str = Field(
        ...,
        min_length=1,
        description="Raw HTML or text body of the main entry.",
    )
    author: str | None = Field(
        None,
        description="Reported author of the feed item.",
    )

    @field_validator("publication_date")
    @classmethod
    def ensure_utc_timezone(cls, val: datetime.datetime) -> datetime.datetime:
        """Normalize naive datetimes to UTC.

        Args:
            val: The parsed publication datetime.

        Returns:
            A timezone-aware UTC datetime.
        """
        if val.tzinfo is None:
            return val.replace(tzinfo=datetime.UTC)
        return val.astimezone(datetime.UTC)

    def model_dump_safe(self) -> dict[str, Any]:
        """Return a JSON-serializable dictionary with string URLs."""
        data = self.model_dump(mode="json")
        return data
