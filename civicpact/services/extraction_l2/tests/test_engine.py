"""Tests for the extraction engine."""

from __future__ import annotations

import datetime

import pytest
from extraction_l2.engine import ExtractionEngine
from extraction_l2.entities import Bill, ExtractionResult, LegislativeEvent
from extraction_l2.llm_client import MockLLMClient
from ingestion_l1.models import RSSFeedItem
from pydantic import HttpUrl


def _make_sample_item() -> RSSFeedItem:
    """Return a sample RSS feed item for extraction tests."""
    return RSSFeedItem(
        id="entry-001",
        feed_id="feed-001",
        title="House Passes HR-104",
        source_url=HttpUrl("https://example.com/hr-104"),
        publication_date=datetime.datetime(2026, 6, 15, 12, 0, tzinfo=datetime.UTC),
        raw_content="The House of Representatives passed HR-104 today.",
        author="Test Author",
    )


_EXPECTED_ENTITY_COUNT = 2


@pytest.mark.asyncio
async def test_extract_returns_mocked_entities() -> None:
    """The engine returns entities produced by the mocked LLM client."""
    item = _make_sample_item()
    expected = ExtractionResult(
        source_entry_id=item.id,
        entities=[
            LegislativeEvent(
                source_feed_id=item.feed_id,
                source_entry_id=item.id,
                confidence_score=0.95,
                event_id="evt-001",
                event_type="Vote",
                jurisdiction="US-Federal",
                summary="The House voted on HR-104.",
                bills_referenced=["HR-104"],
            ),
            Bill(
                source_feed_id=item.feed_id,
                source_entry_id=item.id,
                confidence_score=0.9,
                bill_identifier="HR-104",
                jurisdiction="US-Federal",
            ),
        ],
    )
    engine = ExtractionEngine(MockLLMClient(expected))

    result = await engine.extract(item)

    assert result.source_entry_id == item.id
    assert len(result.entities) == _EXPECTED_ENTITY_COUNT
    assert isinstance(result.entities[0], LegislativeEvent)
    assert isinstance(result.entities[1], Bill)


@pytest.mark.asyncio
async def test_extract_corrects_hallucinated_source_entry_id() -> None:
    """The engine overwrites a mismatched source_entry_id from the LLM."""
    item = _make_sample_item()
    hallucinated = ExtractionResult(
        source_entry_id="wrong-entry-id",
        entities=[
            LegislativeEvent(
                source_feed_id=item.feed_id,
                source_entry_id=item.id,
                confidence_score=0.95,
                event_id="evt-001",
                event_type="Vote",
                jurisdiction="US-Federal",
                summary="The House voted.",
            ),
        ],
    )
    engine = ExtractionEngine(MockLLMClient(hallucinated))

    result = await engine.extract(item)

    assert result.source_entry_id == item.id
    assert len(result.entities) == 1
