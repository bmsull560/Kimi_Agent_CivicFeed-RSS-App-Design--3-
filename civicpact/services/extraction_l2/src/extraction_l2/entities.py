"""Pydantic v2 schemas for structured civic entities extracted from news."""

from __future__ import annotations

import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


class CivicEntity(BaseModel):
    """Base class for all civic entities extracted from news articles."""

    entity_type: str = Field(..., description="Discriminator for the entity kind.")
    source_feed_id: str = Field(..., description="ID of the originating RSS feed.")
    source_entry_id: str = Field(
        ..., description="ID of the specific RSS entry the entity was derived from."
    )
    confidence_score: float = Field(
        ..., ge=0.0, le=1.0, description="Extraction confidence score."
    )


class Official(CivicEntity):
    """A government official or public figure mentioned in civic news."""

    entity_type: Literal["official"] = "official"
    name: str = Field(..., min_length=1, description="Full name of the official.")
    title: str | None = Field(None, description="Official title or role.")
    jurisdiction: str | None = Field(
        None, description="Geopolitical boundary (e.g. US-GA, US-Federal)."
    )
    party_affiliation: str | None = Field(None, description="Political party, if known.")


class Organization(CivicEntity):
    """A government agency, nonprofit, company, or civic organization."""

    entity_type: Literal["organization"] = "organization"
    name: str = Field(..., min_length=1, description="Name of the organization.")
    organization_type: str | None = Field(
        None, description="Classifications such as agency, company, nonprofit."
    )


class Location(CivicEntity):
    """A geographic location relevant to civic news."""

    entity_type: Literal["location"] = "location"
    name: str = Field(..., min_length=1, description="Location name.")
    location_type: str | None = Field(None, description="City, county, state, country, etc.")


class Bill(CivicEntity):
    """A legislative bill, resolution, or act referenced in civic news."""

    entity_type: Literal["bill"] = "bill"
    bill_identifier: str = Field(
        ...,
        pattern=r"^[A-Za-z]{1,4}-\d+$",
        description="Standardized bill ID (e.g. HR-104, SB-12).",
    )
    jurisdiction: str = Field(
        ..., description="Geopolitical boundary code (e.g. US-GA, US-Federal)."
    )
    title: str | None = Field(None, description="Short title of the bill.")
    status: str | None = Field(None, description="Current legislative status.")
    sponsors: list[str] = Field(default_factory=list, description="Named sponsors.")

    @field_validator("bill_identifier")
    @classmethod
    def normalize_bill_identifier(cls, val: str) -> str:
        """Normalize bill identifiers to uppercase for consistency."""
        return val.upper()


class LegislativeEvent(CivicEntity):
    """A civic or legislative action described in a news article."""

    entity_type: Literal["legislative_event"] = "legislative_event"
    event_id: str = Field(
        ..., description="Generated stable identifier for this extraction event."
    )
    event_type: str = Field(
        ...,
        description="Classified type of event (e.g. Vote, Hearing, Amendment, Signing).",
    )
    event_date: datetime.datetime | None = Field(
        None, description="Date the event occurred or was reported."
    )
    jurisdiction: str = Field(
        ..., description="Geopolitical boundary code (e.g. US-GA, US-Federal)."
    )
    summary: str = Field(..., min_length=10, description="Concise summary of the event.")
    officials_involved: list[str] = Field(
        default_factory=list, description="Officials mentioned in relation to the event."
    )
    organizations_involved: list[str] = Field(
        default_factory=list,
        description="Organizations or agencies mentioned in relation to the event.",
    )
    bills_referenced: list[str] = Field(
        default_factory=list,
        description="Bill identifiers referenced in the event.",
    )
    impact_score: float | None = Field(
        None,
        ge=-1.0,
        le=1.0,
        description="Sentiment or impact score from -1 (negative) to 1 (positive).",
    )

    @field_validator("event_date")
    @classmethod
    def ensure_utc_timezone(cls, val: datetime.datetime | None) -> datetime.datetime | None:
        """Normalize naive datetimes to UTC."""
        if val is None:
            return None
        if val.tzinfo is None:
            return val.replace(tzinfo=datetime.UTC)
        return val.astimezone(datetime.UTC)


CivicEntityVariant = Annotated[
    LegislativeEvent | Bill | Official | Organization | Location,
    Field(discriminator="entity_type"),
]


class ExtractionResult(BaseModel):
    """Container for all entities extracted from a single RSS feed item."""

    source_entry_id: str = Field(..., description="ID of the RSS entry that was analyzed.")
    extracted_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC),
        description="UTC timestamp when extraction occurred.",
    )
    entities: list[CivicEntityVariant] = Field(
        default_factory=list,
        description="Discriminated list of extracted civic entities.",
    )

    @field_validator("extracted_at")
    @classmethod
    def ensure_utc_extracted_at(cls, val: datetime.datetime) -> datetime.datetime:
        """Normalize extraction timestamp to UTC."""
        if val.tzinfo is None:
            return val.replace(tzinfo=datetime.UTC)
        return val.astimezone(datetime.UTC)
