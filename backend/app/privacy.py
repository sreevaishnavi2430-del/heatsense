"""Privacy helpers for subscriber phone-number handling.

Phone numbers are Indian mobile numbers: 10 digits with a leading 6, 7, 8 or 9.
That means only ~40 million values are valid, so a plain SHA-256 digest of the
number is trivially reversible (a GPU exhausts the space in seconds). Every
lookup key here is therefore a keyed HMAC over a per-deployment salt, which
cannot be brute-forced from the stored value alone.
"""
from __future__ import annotations

import hashlib
import hmac

from app.config import settings


def normalise_phone(phone: str) -> str:
    """Return the last 10 digits of a phone string, or an empty string."""
    return "".join(c for c in str(phone) if c.isdigit())[-10:]


def is_valid_mobile(digits: str) -> bool:
    """True when the digits form a plausible Indian mobile number."""
    return len(digits) == 10 and digits[0] in "6789"


def phone_lookup_hash(digits: str) -> str:
    """Keyed, deterministic hash used to look up a subscriber by phone number.

    Uses HMAC-SHA256 with the deployment SECRET_KEY, so the digest cannot be
    reversed by brute-forcing the (small) valid phone-number space.
    """
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        digits.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
