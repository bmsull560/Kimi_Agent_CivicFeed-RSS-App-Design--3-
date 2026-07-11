"""Structured error classes for the CivicPact platform."""

from __future__ import annotations

from typing import Any


class CivicPactBaseException(Exception):  # noqa: N818
    """Root exception for all CivicPact domain errors.

    This class bans plain string serialization of base errors. Callers should
    rely on :meth:`serialize_error` or typed attributes for recovery logic.

    Args:
        error_code: Structured code in the form ``CF-{LAYER}-{SUBCODE}``.
        message: Human-readable error description.
        context_details: Optional structured context captured at failure time.
    """

    def __init__(
        self,
        error_code: str,
        message: str,
        context_details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the structured exception.

        Args:
            error_code: Structured error code.
            message: Human-readable message.
            context_details: Optional structured context.
        """
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.context_details = context_details or {}

    def serialize_error(self) -> dict[str, Any]:
        """Return a safe dictionary representation of the error.

        Returns:
            Dictionary containing ``error_code``, ``message``, and
            ``context_details``. Raw stack traces are intentionally omitted.
        """
        return {
            "error_code": self.error_code,
            "message": self.message,
            "context_details": self.context_details,
        }


class RSSIngestionError(CivicPactBaseException):
    """Raised when feed ingestion fails due to network, parse, or safety errors."""


class SecurityError(CivicPactBaseException):
    """Raised when a security policy (e.g. SSRF) blocks a request."""


class TenantIsolationError(CivicPactBaseException):
    """Raised when tenant isolation invariants are violated."""


class DatabaseError(CivicPactBaseException):
    """Raised when a database operation fails."""
