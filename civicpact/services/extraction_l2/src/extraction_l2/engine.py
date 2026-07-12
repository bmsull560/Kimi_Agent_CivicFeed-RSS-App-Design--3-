"""Entity extraction engine for CivicPact Layer 2."""

from __future__ import annotations

from ingestion_l1.models import RSSFeedItem

from extraction_l2.entities import ExtractionResult
from extraction_l2.llm_client import LLMClient

_EXTRACTION_PROMPT_TEMPLATE = """\
Analyze the following civic news article and extract structured entities.

Feed ID: {feed_id}
Entry ID: {entry_id}
Title: {title}
Publication Date: {publication_date}
Author: {author}
Content:
{content}

Extract the following entity types if present:
- legislative_event: a civic or legislative action
- bill: a legislative bill, resolution, or act
- official: a government official or public figure
- organization: a government agency, nonprofit, company, or civic organization
- location: a geographic location relevant to the news

Return a JSON object matching this exact schema:
{{
  "source_entry_id": "{entry_id}",
  "entities": [
    {{
      "entity_type": "legislative_event",
      "source_feed_id": "{feed_id}",
      "source_entry_id": "{entry_id}",
      "confidence_score": 0.95,
      "event_id": "evt_unique_id",
      "event_type": "Vote",
      "event_date": "2026-06-15T12:00:00Z",
      "jurisdiction": "US-Federal",
      "summary": "Concise summary of the event.",
      "officials_involved": ["Name One", "Name Two"],
      "organizations_involved": ["Agency Name"],
      "bills_referenced": ["HR-104"],
      "impact_score": 0.5
    }}
  ]
}}

Use empty arrays for missing fields. Use ISO 8601 UTC timestamps."""


class ExtractionEngine:
    """Extracts structured civic entities from RSS feed items.

    Args:
        llm_client: An implementation of ``LLMClient`` that produces
            schema-validated ``ExtractionResult`` outputs.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        """Initialize the engine with an LLM client.

        Args:
            llm_client: Provider-agnostic LLM client.
        """
        self._llm_client = llm_client

    def _build_prompt(self, item: RSSFeedItem) -> str:
        """Build the extraction prompt from an RSS feed item.

        Args:
            item: Raw RSS feed item from Layer 1.

        Returns:
            Formatted prompt string.
        """
        return _EXTRACTION_PROMPT_TEMPLATE.format(
            feed_id=item.feed_id,
            entry_id=item.id,
            title=item.title,
            publication_date=item.publication_date,
            author=item.author or "Unknown",
            content=item.raw_content,
        )

    async def extract(self, item: RSSFeedItem) -> ExtractionResult:
        """Extract civic entities from a single RSS feed item.

        Args:
            item: Raw RSS feed item from Layer 1.

        Returns:
            ``ExtractionResult`` containing validated civic entities.
        """
        prompt = self._build_prompt(item)
        result = await self._llm_client.complete_structured(prompt, ExtractionResult)
        # Ensure the result references the correct source entry even if the LLM
        # omits or hallucinates the field.
        if result.source_entry_id != item.id:
            result = ExtractionResult(
                source_entry_id=item.id,
                extracted_at=result.extracted_at,
                entities=result.entities,
            )
        return result
