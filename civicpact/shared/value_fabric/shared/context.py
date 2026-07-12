"""Tenant-aware context isolation using Python contextvars."""

from __future__ import annotations

import contextvars
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from contextvars import Token

_tenant_context: contextvars.ContextVar[uuid.UUID] = contextvars.ContextVar("tenant_id")


class TenantContextError(Exception):
    """Raised when an operation requires an active tenant context but none exists."""


class TenantContext:
    """Context manager for binding a tenant ID to the active async context.

    Args:
        tenant_id: The UUID of the tenant to bind.

    Example:
        async with TenantContext(tenant_id):
            current = get_current_tenant_id()
    """

    def __init__(self, tenant_id: uuid.UUID) -> None:
        """Initialize the context manager with a tenant ID.

        Args:
            tenant_id: The tenant UUID to bind.
        """
        self._tenant_id = tenant_id
        self._token: Token[uuid.UUID] | None = None

    async def __aenter__(self) -> TenantContext:
        """Bind the tenant ID when entering the async context."""
        self._token = _tenant_context.set(self._tenant_id)
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        """Reset the tenant context when exiting."""
        if self._token is not None:
            _tenant_context.reset(self._token)


def get_current_tenant_id() -> uuid.UUID:
    """Return the active tenant ID from the current async context.

    Returns:
        The UUID of the currently bound tenant.

    Raises:
        TenantContextError: If no tenant context has been initialized.
    """
    try:
        return _tenant_context.get()
    except LookupError as err:
        raise TenantContextError(
            "Operation attempted without an active tenant context."
        ) from err


def set_current_tenant_id(tenant_id: uuid.UUID) -> Token[uuid.UUID]:
    """Bind a tenant ID to the current async context.

    Args:
        tenant_id: The tenant UUID to bind.

    Returns:
        A token that can be used with ``contextvars.ContextVar.reset``.
    """
    return _tenant_context.set(tenant_id)


def reset_current_tenant_id(token: Token[uuid.UUID]) -> None:
    """Reset the tenant context using a previously returned token.

    Args:
        token: The token returned by ``set_current_tenant_id``.
    """
    _tenant_context.reset(token)
