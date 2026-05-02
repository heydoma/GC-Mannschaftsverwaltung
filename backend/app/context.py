"""Request-scoped Kontext für Tenant und Authentifizierung."""
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, Optional


@dataclass(frozen=True)
class TenantContext:
    team_id: int
    schema_name: str
    tenant_slug: Optional[str] = None
    realm: Optional[str] = None
    host: Optional[str] = None


_tenant_context: ContextVar[Optional[TenantContext]] = ContextVar("tenant_context", default=None)
_auth_context: ContextVar[Optional[dict[str, Any]]] = ContextVar("auth_context", default=None)


def set_tenant_context(context: Optional[TenantContext]):
    return _tenant_context.set(context)


def get_tenant_context() -> Optional[TenantContext]:
    return _tenant_context.get()


def reset_tenant_context(token) -> None:
    _tenant_context.reset(token)


def set_auth_context(context: Optional[dict[str, Any]]):
    return _auth_context.set(context)


def get_auth_context() -> Optional[dict[str, Any]]:
    return _auth_context.get()


def reset_auth_context(token) -> None:
    _auth_context.reset(token)