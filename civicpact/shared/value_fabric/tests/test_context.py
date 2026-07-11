"""Tests for tenant context isolation."""

from __future__ import annotations

import asyncio
import uuid

import pytest

from value_fabric.shared.context import (
    TenantContext,
    TenantContextError,
    get_current_tenant_id,
    reset_current_tenant_id,
    set_current_tenant_id,
)


@pytest.mark.asyncio
async def test_tenant_context_isolation() -> None:
    """Concurrent async contexts must keep tenant IDs isolated."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()

    async def run_for_tenant(tenant_id: uuid.UUID) -> uuid.UUID:
        token = set_current_tenant_id(tenant_id)
        try:
            await asyncio.sleep(0.01)
            return get_current_tenant_id()
        finally:
            reset_current_tenant_id(token)

    results = await asyncio.gather(
        run_for_tenant(tenant_a),
        run_for_tenant(tenant_b),
    )

    assert results[0] == tenant_a
    assert results[1] == tenant_b


@pytest.mark.asyncio
async def test_tenant_context_manager() -> None:
    """TenantContext binds and resets the tenant ID correctly."""
    tenant_id = uuid.uuid4()

    async with TenantContext(tenant_id):
        assert get_current_tenant_id() == tenant_id

    with pytest.raises(TenantContextError):
        get_current_tenant_id()


def test_missing_tenant_context_raises() -> None:
    """Reading tenant context outside any binding must fail cleanly."""
    with pytest.raises(TenantContextError):
        get_current_tenant_id()
