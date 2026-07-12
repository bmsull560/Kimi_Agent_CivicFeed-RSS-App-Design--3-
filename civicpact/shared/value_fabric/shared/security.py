"""Security utilities for URL validation and SSRF protection."""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse

from value_fabric.shared.errors import SecurityError


class UnsafeUrlError(SecurityError):
    """Raised when a URL is blocked by the SSRF policy."""

    def __init__(self, url: str, reason: str) -> None:
        """Initialize with the blocked URL and reason.

        Args:
            url: The URL that was rejected.
            reason: Human-readable explanation of why it was rejected.
        """
        super().__init__(
            error_code="CF-001-001",
            message=f"URL blocked by security policy: {reason}",
            context_details={"blocked_url": url, "reason": reason},
        )


# IPv4 and IPv6 loopback/link-local/metadata-service patterns.
_PRIVATE_PATTERNS = [
    re.compile(r"^127\."),
    re.compile(r"^10\."),
    re.compile(r"^172\.(1[6-9]|2[0-9]|3[01])\."),
    re.compile(r"^192\.168\."),
    re.compile(r"^169\.254\."),  # link-local
    re.compile(r"^0\."),
    re.compile(r"^::1$"),
    re.compile(r"^fc00:", re.IGNORECASE),
    re.compile(r"^fe80:", re.IGNORECASE),
]

# Hostnames that should never be resolved or fetched.
_BLOCKED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",  # cloud metadata service
}

# Common non-HTTP schemes that should not be fetched.
_ALLOWED_SCHEMES = {"http", "https"}


def validate_url(url: str) -> str:
    """Validate a URL and enforce SSRF protections.

    Args:
        url: The URL string to validate.

    Returns:
        The normalized URL string if it is safe.

    Raises:
        UnsafeUrlError: If the URL uses a disallowed scheme, lacks a hostname,
            or resolves to a private/loopback/link-local/metadata-service target.
    """
    parsed = urlparse(url)

    if not parsed.scheme or parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UnsafeUrlError(url, f"scheme '{parsed.scheme}' is not allowed")

    hostname = parsed.hostname
    if not hostname:
        raise UnsafeUrlError(url, "URL is missing a hostname")

    lower_hostname = hostname.lower()
    if lower_hostname in _BLOCKED_HOSTS:
        raise UnsafeUrlError(url, f"hostname '{hostname}' is blocked")

    # If the hostname is already an IP address, check it directly.
    try:
        ip = ipaddress.ip_address(hostname)
        if _is_private_or_reserved(ip):
            raise UnsafeUrlError(url, f"IP address '{hostname}' is private or reserved")
        return url
    except ValueError:
        pass  # hostname is not a literal IP

    # Reject hostnames that look like IPs or metadata endpoints.
    for pattern in _PRIVATE_PATTERNS:
        if pattern.search(hostname):
            raise UnsafeUrlError(url, f"hostname '{hostname}' matches blocked pattern")

    return url


def _is_private_or_reserved(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if an IP address is private, loopback, link-local, or reserved."""
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )
