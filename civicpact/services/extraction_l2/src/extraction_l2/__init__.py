"""CivicPact Layer 2: Legislative and News Entity Extraction."""

from extraction_l2.engine import ExtractionEngine
from extraction_l2.entities import (
    Bill,
    CivicEntity,
    ExtractionResult,
    LegislativeEvent,
    Location,
    Official,
    Organization,
)
from extraction_l2.llm_client import (
    LLMClient,
    LLMExtractionError,
    MockLLMClient,
    OpenAICompatibleClient,
)

__all__ = [
    "Bill",
    "CivicEntity",
    "ExtractionEngine",
    "ExtractionResult",
    "LLMClient",
    "LLMExtractionError",
    "LegislativeEvent",
    "Location",
    "MockLLMClient",
    "Official",
    "OpenAICompatibleClient",
    "Organization",
]
