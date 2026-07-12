"""Celery task definitions for Layer 1 ingestion."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from celery import Celery
from value_fabric.shared.context import reset_current_tenant_id, set_current_tenant_id
from value_fabric.shared.errors import CivicPactBaseException

from ingestion_l1.fetcher import fetch_feed
from ingestion_l1.models import RSSFeedItem
from ingestion_l1.parser import parse_feed

# Default broker URL is expected to be overridden via environment.
celery_app = Celery(
    "ingestion_l1",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
)


def _serialize_items(items: list[RSSFeedItem]) -> list[dict[str, Any]]:
    """Convert parsed items to JSON-serializable dictionaries."""
    return [item.model_dump_safe() for item in items]


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)  # type: ignore[untyped-decorator]
def ingest_feed_task(
    self: Any,
    feed_url: str,
    feed_id: str,
    tenant_id: str,
) -> dict[str, Any]:
    """Celery task that fetches and parses a single feed.

    Args:
        self: The bound Celery task instance (used for retry control).
        feed_url: The URL of the feed to ingest.
        feed_id: Logical identifier of the feed.
        tenant_id: UUID string of the tenant owning this request.

    Returns:
        Dictionary containing ``feed_id``, ``tenant_id``, and ``items``.

    Raises:
        CivicPactBaseException: On structured failures, with automatic Celery
            retry for transient errors.
    """
    token = set_current_tenant_id(uuid.UUID(tenant_id))
    try:
        raw_body = asyncio.run(fetch_feed(feed_url, feed_id))
        items = parse_feed(raw_body, feed_id)
        return {
            "feed_id": feed_id,
            "tenant_id": tenant_id,
            "items": _serialize_items(items),
        }
    except CivicPactBaseException:
        # Structured domain errors are propagated without serialization loss.
        raise
    except Exception as err:
        # Wrap unexpected runtime failures and retry.
        raise self.retry(exc=err) from err
    finally:
        reset_current_tenant_id(token)
