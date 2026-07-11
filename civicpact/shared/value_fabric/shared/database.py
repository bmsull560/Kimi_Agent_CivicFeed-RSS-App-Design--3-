"""Async database session management with tenant isolation."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from value_fabric.shared.context import TenantContextError, get_current_tenant_id
from value_fabric.shared.errors import DatabaseError


class DatabaseManager:
    """Manages async PostgreSQL engine and tenant-aware sessions.

    Args:
        database_url: SQLAlchemy async PostgreSQL URL.
        engine_kwargs: Optional additional arguments passed to
            ``create_async_engine``.
    """

    def __init__(
        self,
        database_url: str,
        engine_kwargs: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the database manager.

        Args:
            database_url: Async PostgreSQL connection URL.
            engine_kwargs: Optional engine creation arguments.
        """
        self._database_url = database_url
        self._engine = create_async_engine(
            database_url,
            **(engine_kwargs or {"pool_size": 20, "max_overflow": 10}),
        )
        self._session_factory = async_sessionmaker(
            bind=self._engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Yield a tenant-scoped async database session.

        The current tenant ID is read from the active context and attached to
        ``session.info`` for downstream filtering or audit hooks.

        Yields:
            An active ``AsyncSession`` bound to the current tenant context.

        Raises:
            TenantContextError: If no tenant context is active.
            DatabaseError: If the session cannot be created.
        """
        try:
            tenant_id = get_current_tenant_id()
        except TenantContextError as err:
            raise DatabaseError(
                error_code="CF-003-001",
                message="Database session requested without an active tenant context.",
            ) from err

        session = self._session_factory()
        session.info["tenant_id"] = tenant_id
        try:
            yield session
        except Exception as err:
            await session.rollback()
            raise DatabaseError(
                error_code="CF-003-002",
                message="Database session transaction failed.",
                context_details={"exception_type": type(err).__name__},
            ) from err
        finally:
            await session.close()

    async def close(self) -> None:
        """Dispose of the underlying engine and connection pool."""
        await self._engine.dispose()
