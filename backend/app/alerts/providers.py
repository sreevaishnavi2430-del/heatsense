"""Alert provider interface for HeatSense SMS/voice notifications.

IMPORTANT DISCLAIMER:
Live SMS sending via Twilio or any telecom operator in India requires:
  - A registered Twilio account with India-approved numbers
  - TRAI DLT (Distributed Ledger Technology) registration for commercial messaging
  - Pre-approved message templates registered with your Principal Entity ID
  - Written consent from recipients (already captured at subscription time)
The MockAlertProvider is safe for demos. The TwilioProvider is a STUB only.
Do NOT enable live sending without completing the above regulatory requirements.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseAlertProvider(ABC):
    """Abstract provider interface for dispatching alerts."""

    @abstractmethod
    async def send(self, recipient_phone: str, message: str, language: str = "en") -> dict[str, Any]:
        """Send alert to a single recipient. Returns delivery status dict."""
        ...

    async def send_bulk(
        self,
        recipients: list[dict[str, Any]],
        message_template: str,
        ward_name: str = "your ward",
        temp: str = "N/A",
    ) -> list[dict[str, Any]]:
        """Send alert to multiple recipients. Default iterates send() per recipient."""
        results = []
        for r in recipients:
            phone = r.get("phone", "")
            lang = r.get("language", "en")
            msg = message_template.format(ward=ward_name, temp=temp)
            result = await self.send(phone, msg, lang)
            results.append({"recipientId": r.get("id"), **result})
        return results


class MockAlertProvider(BaseAlertProvider):
    """Mock provider for demos and tests. Logs messages but does NOT send any SMS."""

    def __init__(self):
        self.sent: list[dict[str, Any]] = []

    async def send(self, recipient_phone: str, message: str, language: str = "en") -> dict[str, Any]:
        masked = f"****{recipient_phone[-4:]}" if len(recipient_phone) >= 4 else "****"
        entry = {
            "status": "mock_sent",
            "to": masked,
            "language": language,
            "message_preview": message[:80],
            "provider": "mock",
        }
        self.sent.append(entry)
        logger.info("[MOCK ALERT] To %s (%s): %s", masked, language, message[:80])
        return entry


class TwilioProvider(BaseAlertProvider):
    """STUB — Twilio provider. Requires TRAI DLT registration before enabling live sends.

    To activate:
    1. Install twilio: pip install twilio
    2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env
    3. Register message templates with TRAI DLT (https://www.trai.gov.in/)
    4. Replace STUB_ONLY block below with actual Twilio client send call.
    """

    STUB_ONLY = True  # Safety guard — change only after DLT registration

    def __init__(self, account_sid: str = "", auth_token: str = "", from_number: str = ""):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    async def send(self, recipient_phone: str, message: str, language: str = "en") -> dict[str, Any]:
        if self.STUB_ONLY:
            logger.warning(
                "TwilioProvider.send() called but STUB_ONLY=True. "
                "Complete TRAI DLT registration and set STUB_ONLY=False to enable live SMS."
            )
            return {"status": "stub_only", "provider": "twilio", "note": "DLT registration required"}
        # ─── REAL SEND (activate only after DLT registration) ────────────────
        # from twilio.rest import Client
        # client = Client(self.account_sid, self.auth_token)
        # message_obj = client.messages.create(
        #     body=message,
        #     from_=self.from_number,
        #     to=f"+91{recipient_phone[-10:]}",
        # )
        # return {"status": "sent", "sid": message_obj.sid, "provider": "twilio"}
        raise NotImplementedError("DLT registration required before enabling live sends.")


# Module-level default provider (safe for demos)
_default_provider: BaseAlertProvider = MockAlertProvider()


def get_alert_provider() -> BaseAlertProvider:
    """Return the currently configured alert provider."""
    return _default_provider


def set_alert_provider(provider: BaseAlertProvider) -> None:
    """Configure the global alert provider (e.g., in tests or startup)."""
    global _default_provider
    _default_provider = provider
