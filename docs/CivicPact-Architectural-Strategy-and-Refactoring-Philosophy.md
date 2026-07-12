# CivicPact: Architectural Strategy and Refactoring Philosophy

_Elevating the CivicFeed RSS Agent Platform to Google-Scale L8 Engineering Standards_

---

## 1. Executive Summary & Refactoring Philosophy

The CivicFeed RSS Agent Platform (branded as **CivicPact**) is an enterprise-grade intelligence system designed to ingest high-velocity RSS feeds, parse complex policy and news documents, extract structured civic insights, and deliver targeted legislative alert intelligence.

To transition this platform from a standard web-scale pipeline to an **L8-level (Google-scale) resilient architecture**, we must establish a zero-trust, highly deterministic, and self-healing execution model. This strategy addresses the fragile, highly variable nature of public civic data, dynamic news paywalls, and non-deterministic Language Model (LLM) outputs.

### The L8 Engineering Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    CivicPact Core Invariants                    │
├────────────────────────────────┬────────────────────────────────┤
│       Runtime Safety           │   No uncaught exceptions. All  │
│                                │   errors mapped to typed domain│
│                                │   codes. No str(e) serialization.│
├────────────────────────────────┼────────────────────────────────┤
│   Architectural Predictability │   Thread/Async context isolation│
│                                │   via ContextVars. Zero-leak    │
│                                │   multi-tenancy.                │
├────────────────────────────────┼────────────────────────────────┤
│     Interface Segregation      │   Strict Pydantic v2 boundaries │
│                                │   separating the 7 layers.      │
└────────────────────────────────┴────────────────────────────────┘
```

- **Runtime Safety**: Standard Python exception structures are inherently fragile in high-throughput async processing. We enforce absolute isolation of execution paths. Generics, strict type-hints, and domain-level error-wrapping classes are mandatory. The usage of `str(e)` is strictly prohibited; all errors must map to strongly typed structured failures.
- **Architectural Predictability**: Highly concurrent scrapers and multi-tenant agent execution loops must never leak data across tenant boundaries. We leverage Python's `contextvars` to propagate tenant state natively down the async call stack, ensuring database sessions, logging context, and caching mechanisms remain strictly sandboxed.
- **Interface Segregation**: To scale development across distributed engineering squads, each architectural boundary must be defined by strict schemas. No raw dictionaries or unstructured payloads may pass between the system layers.

---

## 2. The 7-Layer CivicFeed RSS Architecture (CivicPact)

The CivicPact platform is structured into seven distinct layers, ensuring that changes within one domain (e.g., switching LLM providers or upgrading the vector index) do not disrupt adjacent systems.

```
       +-------------------------------------------------------+
Layer 7| Cross-Layer Alert API, Delivery & Tenant Profiles      |
       +-------------------------------------------------------+
                                  ▲
                                  │ Alert Payloads / Configuration
                                  ▼
       +-------------------------------------------------------+
Layer 6| Civic Impact & Benchmark Service                      |
       +-------------------------------------------------------+
                                  ▲
                                  │ Sentiment & Metric Aggregates
                                  ▼
       +-------------------------------------------------------+
Layer 5| Truth & Source Verification                           |
       +-------------------------------------------------------+
                                  ▲
                                  │ Verified Cross-References
                                  ▼
       +-------------------------------------------------------+
Layer 4| Agentic Civic Analyst Engine (LangGraph)              |
       +-------------------------------------------------------+
                                  ▲
                                  │ Graph Context & State Checkpoints
                                  ▼
       +-------------------------------------------------------+
Layer 3| Civic Knowledge Graph & Vector Layer (Neo4j/pgvector)  |
       +-------------------------------------------------------+
                                  ▲
                                  │ Graph/Dense Vector Queries
                                  ▼
       +-------------------------------------------------------+
Layer 2| Legislative & News Entity Extraction (Pydantic v2)     |
       +-------------------------------------------------------+
                                  ▲
                                  │ Clean Structured Raw Entities
                                  ▼
       +-------------------------------------------------------+
Layer 1| RSS Ingestion & Web Scraping (Playwright/Celery)       |
       +-------------------------------------------------------+
```

### Layer-by-Layer Architectural Deep-Dive

| Layer                                                                                                              | Layer Name                                    | Core Technologies                                              | Responsibility & Input/Output Contracts                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**                                                                                                              | **RSS Ingestion & Web Scraping**              | Playwright, Celery, Redis, PostgreSQL                          | **Responsibility**: Ingestion of raw RSS and Atom feeds. Orchestrates headless browsers (Playwright) to bypass Cloudflare/paywalls, extracts clean HTML, and buffers raw payloads.                                                                                        |
| **Inputs**: RSS feed URLs, target news seeds.                                                                      |
| **Outputs**: Standardized JSON payload containing raw feed items and extracted body text.                          |
| **2**                                                                                                              | **Legislative & News Entity Extraction**      | Pydantic v2, LLM API Providers (Instructor/Structured Outputs) | **Responsibility**: Transformation of raw unstructured article text into schema-validated data models containing civic entities (e.g., Bills, Officials, Lobbyists, Organizations).                                                                                       |
| **Inputs**: Raw HTML text and metadata.                                                                            |
| **Outputs**: Highly structured, type-checked Pydantic v2 entities.                                                 |
| **3**                                                                                                              | **Civic Knowledge Graph & Vector Layer**      | Neo4j, pgvector, Ollama/OpenAI Embeddings                      | **Responsibility**: Resolving references across items. Generates dense embeddings for unstructured passages while mapping structural relationships (e.g., `OFFICIAL` -> `SPONSORS` -> `BILL`). Executes hybrid searches (dense vector + lexical BM25 + Cypher traversal). |
| **Inputs**: Structured Pydantic Entities.                                                                          |
| **Outputs**: Graph nodes, edges, and dense vector indexes.                                                         |
| **4**                                                                                                              | **Agentic Civic Analyst Engine**              | LangGraph, LangChain, State Checkpointers                      | **Responsibility**: State-machine-based analysis. Runs dedicated "Policy Analyst" and "Alert Synthesizer" agents to monitor, digest, and generate policy impact briefs based on the current context.                                                                      |
| **Inputs**: Query parameters, recent vector search matches.                                                        |
| **Outputs**: Dynamic synthetic intelligence summaries and alert recommendations.                                   |
| **5**                                                                                                              | **Truth & Source Verification**               | Official Legislative APIs (e.g., GovInfo, Congress.gov)        | **Responsibility**: Guardrail and validation engine. Cross-references extracted news statements against authoritative legislative databases to verify claims.                                                                                                             |
| **Inputs**: Extracted claims and agentic outputs.                                                                  |
| **Outputs**: `TruthObject` with absolute compliance scores, confidence metrics, and verification source citations. |
| **6**                                                                                                              | **Civic Impact & Benchmark Service**          | Pandas, Polars, Scikit-Learn                                   | **Responsibility**: Analytics and aggregation pipeline. Calculates macro metrics such as legislative momentum, regional sentiment curves, and media coverage velocity indices.                                                                                            |
| **Inputs**: Historically verified entity states and alert logs.                                                    |
| **Outputs**: Aggregated trend matrices and JSON schema analytics reports.                                          |
| **7**                                                                                                              | **Cross-layer Alert API & Tenant Management** | FastAPI, PostgreSQL, SendGrid, Twilio, Slack Webhooks          | **Responsibility**: System egress and tenant isolator. Dynamically filters alerts against active customer tenant profile scopes. Delivers prioritized briefings to destination integrations.                                                                              |
| **Inputs**: Synthetic analyst briefs and benchmark triggers.                                                       |
| **Outputs**: SMS, Email, Slack/Discord messages, and Webhook payloads.                                             |

---

## 3. Monorepo Directory Layout

The entire platform is organized as a unified monorepo to ensure shared type-safety, unified configuration, and streamlined test execution.

```text
civicpact-monorepo/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── pyproject.toml              # Global Poetry workspace configuration
├── ruff.toml                   # Strict linting, formatting, and import sorting rules
├── shared/                     # The core "Value Fabric" shared package
│   └── value_fabric/
│       └── shared/
│           ├── __init__.py
│           ├── context.py      # ContextVar-based tenant isolation managers
│           ├── errors.py       # Custom base exceptions (CF-XXX-XXX) and mappings
│           ├── security.py     # JWT & tenant profile authorization helpers
│           └── database.py     # Async session managers and connection pool configurations
├── services/                   # Microservices mapping directly to architecture layers
│   ├── ingestion_l1/           # Layer 1: Playwright scrapers and Celery queue handlers
│   │   ├── src/
│   │   └── tests/
│   ├── extraction_l2/          # Layer 2: LLM Pydantic parsers
│   │   ├── src/
│   │   └── tests/
│   ├── graph_vector_l3/        # Layer 3: Neo4j & pgvector abstractions
│   │   ├── src/
│   │   └── tests/
│   ├── analyst_engine_l4/      # Layer 4: LangGraph state machines
│   │   ├── src/
│   │   └── tests/
│   ├── verification_l5/        # Layer 5: Fact-checking and external API reconcilers
│   │   ├── src/
│   │   └── tests/
│   ├── impact_benchmark_l6/    # Layer 6: Polars engine calculating benchmarks
│   │   ├── src/
│   │   └── tests/
│   └── egress_api_l7/          # Layer 7: FastAPI gateway and delivery workers
│       ├── src/
│       └── tests/
└── docker-compose.yml          # Local development stack (Redis, Neo4j, pgvector)
```

---

## 4. The Customized 'L8 Principal Engineer' System Prompt

The following system prompt is designed to programmatically direct LLMs or generative AI instances to generate source code that aligns with the CivicPact core invariants.

```markdown
You are an L8 Principal Software Architect and Systems Engineer specializing in highly concurrent, mission-critical python platforms. You write code that is production-ready, strictly type-safe, and designed for deterministic multi-tenant execution.

Your output must adhere to the following uncompromising standards:

1. ARCHITECTURAL INVARIANTS:
   - Tenant isolation must be achieved natively using Python 'contextvars'. Raw tenant context must never be manually piped through application layers.
   - All errors must map to strongly typed domain exceptions inheriting from a centralized base class.
   - Using 'str(e)' on base exceptions is strictly banned. You must log tracebacks or use custom validation attributes.
   - Every file must pass 'mypy --strict' checkouts.

2. CODE GENERATION PROTOCOLS:
   - Always use Pydantic v2 with strict typing, native validators, and descriptive fields.
   - Use Google-style docstrings exclusively, mapping out 'Args', 'Returns', and 'Raises'.
   - Implement structured, context-rich logging.
   - Implement thorough mock environments in tests to eliminate reliance on active external APIs or external database backends.

3. REFACTORING & CODE DESIGNS:
   - Avoid generic try-except blocks. Catch specific domain errors and wrap them in a custom exception mapping like:
     CF-{HTTP_CODE_OR_LAYER_INDEX}-{ERROR_SUB_CODE} (e.g., 'CF-500-101').
   - Keep your components decoupled, complying with Layered Architecture boundaries.
   - Use async execution patterns for IO-bound work (database connections, scraping, downstream API calls).
```

---

## 5. Sample Code Snippets

### 5.1. Tenant-Contextvar-Aware Database Session Manager

This module manages isolation levels by wrapping database access inside `contextvars`. This prevents tenant state leakage in async loops.

```python
import contextvars
import uuid
from collections.abc import AsyncGenerator
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Thread/Async task-safe storage for the current tenant context
_tenant_context: contextvars.ContextVar[uuid.UUID] = contextvars.ContextVar("tenant_id")

DATABASE_URL = "postgresql+asyncpg://postgres:secure_password@localhost:5432/civicpact"
engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)
AsyncSessionFactory = async_sessionmaker(bind=engine, expire_on_commit=False)

Base = declarative_base()


class TenantContextError(Exception):
    """Raised when active tenant context is missing."""
    pass


def get_current_tenant_id() -> uuid.UUID:
    """Retrieves the active tenant ID from the async context.

    Returns:
        uuid.UUID: The UUID of the current tenant context.

    Raises:
        TenantContextError: If the context variable has not been initialized.
    """
    try:
        return _tenant_context.get()
    except LookupError as err:
        raise TenantContextError("Database operation attempted without an active tenant context.") from err


def set_current_tenant_id(tenant_id: uuid.UUID) -> contextvars.Token[uuid.UUID]:
    """Binds a new tenant ID to the active context loop.

    Args:
        tenant_id (uuid.UUID): Target tenant identifier.

    Returns:
        contextvars.Token[uuid.UUID]: Context token used to reset the context state.
    """
    return _tenant_context.set(tenant_id)


async def get_tenant_isolated_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields an active database session.

    This function can be combined with SQLAlchemy events to automatically inject
    where clauses or enforce multi-tenant separation.

    Yields:
        AsyncSession: The active, isolated DB session.
    """
    tenant_id = get_current_tenant_id()  # Invariant: Must fail if tenant context is unassigned
    async with AsyncSessionFactory() as session:
        # Developers can bind a tenant execution block here or execute dynamic context configuration
        session.info["tenant_id"] = tenant_id
        yield session
```

### 5.2. Strict Pydantic v2 Schemas

These schemas define the structured contracts between Layer 1, Layer 2, and Layer 3.

```python
import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl, field_validator


class RSSFeedItem(BaseModel):
    """Defines a validated schema representing an RSS source feed post."""
    feed_id: str = Field(..., description="Unique alphanumeric identifier of the originating RSS stream.")
    title: str = Field(..., min_length=2, max_length=500, description="Cleaned title of the RSS entry.")
    source_url: HttpUrl = Field(..., description="Canonical source URL of the article link.")
    publication_date: datetime.datetime = Field(..., description="Standardized UTC timestamp of publication.")
    raw_content: str = Field(..., min_length=10, description="Raw HTML or text body of the main entry.")
    author: Optional[str] = Field(None, description="Reported author of the feed item.")

    @field_validator("publication_date")
    @classmethod
    def ensure_utc_timezone(cls, val: datetime.datetime) -> datetime.datetime:
        """Validates that incoming datetime instances contain active UTC timezones."""
        if val.tzinfo is None:
            return val.replace(tzinfo=datetime.timezone.utc)
        return val


class LegislativeEvent(BaseModel):
    """Represents a structured legislative action parsed from news articles."""
    event_id: str = Field(..., description="Generated UUID string identifying this event.")
    bill_identifier: str = Field(..., pattern=r"^[A-Z]{1,4}-\d+$", description="Standardized bill ID (e.g., HR-104).")
    jurisdiction: str = Field(..., description="Target geopolitical boundary code (e.g., US-GA).")
    event_type: str = Field(..., description="Classified type of event (e.g., Vote, Hearing, Amendment).")
    officials_involved: List[str] = Field(default_factory=list, description="Array of state/national officials present.")
    impact_score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment analysis metric.")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context fields.")
```

### 5.3. Safe Google-Style Error Handling Class

This component maps runtime failures to typed codes while avoiding the unsafe `str(e)` pattern.

```python
import logging
import sys
import traceback
from typing import Dict, Any, Optional

logger = logging.getLogger("CivicPactLogger")


class CivicPactBaseException(Exception):
    """Root class for all exceptions in CivicPact system modules.

    Bans plain string serialization of base errors. Focuses on typed
    recovery structures and explicit code representations.
    """
    def __init__(
        self,
        error_code: str,
        message: str,
        context_details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initializes the base CivicPact structured system exception.

        Args:
            error_code (str): The structured string code formatted as CF-{L-INDEX}-{S-CODE}.
            message (str): Internal error description.
            context_details (Optional[Dict[str, Any]]): Arbitrary structure capturing system states.
        """
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.context_details = context_details or {}

    def serialize_error(self) -> Dict[str, Any]:
        """Provides a safe dictionary serialization representation of this error.

        Returns:
            Dict[str, Any]: Serialized dictionary without raw stack traces.
        """
        return {
            "error_code": self.error_code,
            "message": self.message,
            "context_details": self.context_details
        }


class RSSIngestionError(CivicPactBaseException):
    """Occurs when downstream target servers return broken configurations, time out, or block scrapers."""
    pass


class ExtractionEngine:
    """Provides methods for ingesting feed items and parsing semantic entities."""

    def parse_item_safely(self, feed_payload: Dict[str, Any]) -> LegislativeEvent:
        """Transforms a raw dictionary into a schema-validated LegislativeEvent.

        Args:
            feed_payload (Dict[str, Any]): Raw JSON input data.

        Returns:
            LegislativeEvent: Standardized schema container.

        Raises:
            RSSIngestionError: If parsing fails. Captures state details without exposing stack variables.
        """
        try:
            # Assume parsing logic executes here...
            if "bill_identifier" not in feed_payload:
                raise KeyError("bill_identifier is missing from payload data.")

            return LegislativeEvent(
                event_id="evt_0192837",
                bill_identifier=feed_payload["bill_identifier"],
                jurisdiction=feed_payload.get("jurisdiction", "Unknown"),
                event_type=feed_payload.get("event_type", "Standard"),
                impact_score=0.75
            )

        except (KeyError, TypeError, ValueError) as err:
            tb_info = sys.exc_info()[2]
            tb_lines = traceback.format_tb(tb_info)

            # Map Python standard failures to a structured, traceable error code
            resolved_code = "CF-500-101"
            safe_context = {
                "source_payload_keys": list(feed_payload.keys()),
                "exception_class": type(err).__name__,
                "traceback": tb_lines[-1].strip() if tb_lines else "None"
            }

            # Log full details internally
            logger.error(
                "Failed to parse item. Code: %s, Exception: %s",
                resolved_code,
                type(err).__name__,
                exc_info=True
            )

            # Raise domain-wrapped abstraction (Strictly avoiding raw str(e))
            raise RSSIngestionError(
                error_code=resolved_code,
                message="Incoming document processing failed validation checks.",
                context_details=safe_context
            ) from err
```

### 5.4. Pytest Suite: Deterministic Mocking & Tenant Isolation Invariants

This unit test suite asserts that the tenant-level isolation container behaves deterministically under concurrent execution paths. It mocks LLM outputs to guarantee test stability.

```python
import asyncio
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from typing import Dict, Any

from value_fabric.shared.context import (
    set_current_tenant_id,
    get_current_tenant_id,
    TenantContextError
)


# Simple mock for downstream service dependencies (e.g., an LLM call)
class MockLLMService:
    async def extract_entities(self, prompt: str) -> Dict[str, Any]:
        # Simulates network/async delay
        await asyncio.sleep(0.01)
        return {
            "bill_identifier": "SB-12",
            "jurisdiction": "US-GA",
            "event_type": "Amendment",
            "impact_score": 0.82
        }


@pytest.mark.asyncio
async def test_tenant_context_isolation_enforcement() -> None:
    """Verifies that async context layers strictly segregate concurrent requests."""
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()

    async def run_pipeline_for_tenant(target_tenant_id: uuid.UUID) -> uuid.UUID:
        # Bind context to current async task
        token = set_current_tenant_id(target_tenant_id)
        try:
            # Yield control execution to simulate concurrency interleaving
            await asyncio.sleep(0.05)
            # Retrieve back the active context
            current_context = get_current_tenant_id()
            return current_context
        finally:
            set_current_tenant_id(uuid.UUID("00000000-0000-0000-0000-000000000000"))

    # Execute both routines concurrently
    results = await asyncio.gather(
        run_pipeline_for_tenant(tenant_a_id),
        run_pipeline_for_tenant(tenant_b_id)
    )

    # Invariant: Active contexts must map exactly to their originating coroutines
    assert results[0] == tenant_a_id
    assert results[1] == tenant_b_id


@pytest.mark.asyncio
async def test_tenant_missing_context_throws_safe_exception() -> None:
    """Asserts that queries executed without an active tenant context are rejected."""
    with pytest.raises(TenantContextError) as exc_info:
        _ = get_current_tenant_id()

    assert "Database operation attempted without an active tenant context." in str(exc_info.value)


@pytest.mark.asyncio
@patch.object(MockLLMService, "extract_entities", new_callable=AsyncMock)
async def test_deterministic_llm_parsing_mock(mock_llm: AsyncMock) -> None:
    """Validates that mock pipelines output deterministic mock payloads."""
    # Setup mock behavior
    mock_llm.return_value = {
        "bill_identifier": "HB-44",
        "jurisdiction": "US-FL",
        "event_type": "Vote",
        "impact_score": -0.45
    }

    service = MockLLMService()
    parsed_payload = await service.extract_entities("Extract details from text...")

    assert parsed_payload["bill_identifier"] == "HB-44"
    assert parsed_payload["jurisdiction"] == "US-FL"
    assert parsed_payload["impact_score"] == -0.45
    mock_llm.assert_called_once_with("Extract details from text...")
```
