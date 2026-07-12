"""Provider-agnostic LLM client abstraction for structured extraction."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError
from value_fabric.shared.errors import CivicPactBaseException

T = TypeVar("T", bound=BaseModel)


class LLMExtractionError(CivicPactBaseException):
    """Raised when an LLM structured extraction fails."""


class LLMClient(ABC):
    """Abstract base class for LLM clients that produce structured outputs."""

    @abstractmethod
    async def complete_structured(
        self,
        prompt: str,
        schema: type[T],
    ) -> T:
        """Send a prompt and return a schema-validated response.

        Args:
            prompt: The textual prompt to send to the model.
            schema: Pydantic model class describing the expected response shape.

        Returns:
            An instance of ``schema`` populated by the model response.

        Raises:
            LLMExtractionError: If the request fails or the response cannot be
                validated against ``schema``.
        """


class OpenAICompatibleClient(LLMClient):
    """LLM client for any OpenAI-compatible chat completions endpoint.

    Works with OpenAI, Ollama, vLLM, and other providers exposing the
    ``/v1/chat/completions`` protocol.

    Args:
        base_url: Base URL of the API endpoint.
        api_key: API key or access token.
        model: Model identifier to use for completions.
        timeout_seconds: Request timeout in seconds.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        *,
        timeout_seconds: float = 60.0,
    ) -> None:
        """Initialize the client.

        Args:
            base_url: Provider API base URL.
            api_key: Provider API key.
            model: Model name.
            timeout_seconds: HTTP request timeout.
        """
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds

    async def complete_structured(
        self,
        prompt: str,
        schema: type[T],
    ) -> T:
        """Call the chat completions endpoint and validate against ``schema``.

        Args:
            prompt: The extraction prompt.
            schema: Pydantic model for the expected JSON response.

        Returns:
            Validated schema instance.

        Raises:
            LLMExtractionError: On HTTP, parse, or validation failures.
        """
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a precise civic-news extraction assistant. "
                        "Respond only with valid JSON matching the requested schema."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as err:
                raise LLMExtractionError(
                    error_code="CF-201-001",
                    message=f"LLM API returned HTTP {err.response.status_code}.",
                    context_details={
                        "model": self._model,
                        "status_code": err.response.status_code,
                    },
                ) from err
            except httpx.RequestError as err:
                raise LLMExtractionError(
                    error_code="CF-201-002",
                    message="LLM API request failed.",
                    context_details={
                        "model": self._model,
                        "exception_type": type(err).__name__,
                    },
                ) from err

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return schema.model_validate(parsed)
        except (KeyError, json.JSONDecodeError, ValidationError) as err:
            raise LLMExtractionError(
                error_code="CF-201-003",
                message="LLM response could not be parsed or validated.",
                context_details={"model": self._model, "exception_type": type(err).__name__},
            ) from err


class MockLLMClient(LLMClient):
    """Deterministic LLM client for tests.

    Args:
        response: The Pydantic model instance to return on every call.
    """

    def __init__(self, response: BaseModel) -> None:
        """Initialize with a fixed response.

        Args:
            response: Response model to return.
        """
        self._response = response

    async def complete_structured(
        self,
        _prompt: str,
        schema: type[T],
    ) -> T:
        """Return the preconfigured response cast to the requested schema."""
        return schema.model_validate(self._response.model_dump())
