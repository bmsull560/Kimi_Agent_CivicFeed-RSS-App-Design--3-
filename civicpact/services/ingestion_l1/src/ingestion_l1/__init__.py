"""CivicPact Layer 1: RSS ingestion and web scraping service."""

from ingestion_l1.fetcher import extract_feed_links, fetch_feed
from ingestion_l1.models import RSSFeedItem
from ingestion_l1.parser import parse_feed
from ingestion_l1.scraper import PlaywrightScraper
from ingestion_l1.tasks import celery_app, ingest_feed_task

__all__ = [
    "RSSFeedItem",
    "PlaywrightScraper",
    "celery_app",
    "extract_feed_links",
    "fetch_feed",
    "ingest_feed_task",
    "parse_feed",
]
