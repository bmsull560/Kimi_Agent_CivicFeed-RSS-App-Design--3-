"""Tests for extraction entity schemas."""

from __future__ import annotations

import datetime

import pytest
from extraction_l2.entities import Bill, ExtractionResult, LegislativeEvent
from pydantic import ValidationError


def test_legislative_event_creation() -> None:
    """A LegislativeEvent can be constructed with required fields."""
    event = LegislativeEvent(
        source_feed_id="feed-001",
        source_entry_id="entry-001",
        confidence_score=0.95,
        event_id="evt-001",
        event_type="Vote",
        jurisdiction="US-Federal",
        summary="The House voted on HR-104.",
    )
    assert event.event_type == "Vote"
    assert event.entity_type == "legislative_event"


def test_bill_identifier_normalization() -> None:
    """Bill identifiers are normalized to uppercase."""
    bill = Bill(
        source_feed_id="feed-001",
        source_entry_id="entry-001",
        confidence_score=0.9,
        bill_identifier="hr-104",
        jurisdiction="US-Federal",
    )
    assert bill.bill_identifier == "HR-104"


def test_invalid_bill_identifier_raises() -> None:
    """Malformed bill identifiers fail validation."""
    with pytest.raises(ValidationError):
        Bill(
            source_feed_id="feed-001",
            source_entry_id="entry-001",
            confidence_score=0.9,
            bill_identifier="not-a-bill",
            jurisdiction="US-Federal",
        )


_EXPECTED_ENTITY_COUNT = 2


def test_extraction_result_discriminator() -> None:
    """The discriminated union resolves entities by entity_type."""
    event = LegislativeEvent(
        source_feed_id="feed-001",
        source_entry_id="entry-001",
        confidence_score=0.95,
        event_id="evt-001",
        event_type="Vote",
        jurisdiction="US-Federal",
        summary="The House voted.",
    )
    bill = Bill(
        source_feed_id="feed-001",
        source_entry_id="entry-001",
        confidence_score=0.9,
        bill_identifier="HR-104",
        jurisdiction="US-Federal",
    )
    result = ExtractionResult(
        source_entry_id="entry-001",
        entities=[event, bill],
    )
    assert len(result.entities) == _EXPECTED_ENTITY_COUNT
    assert isinstance(result.entities[0], LegislativeEvent)
    assert isinstance(result.entities[1], Bill)
    assert result.extracted_at.tzinfo == datetime.UTC
