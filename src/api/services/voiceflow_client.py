"""
Swetha Structures CRM - VoiceFlow API Client
================================================
Thin httpx wrapper for the external VoiceFlow SaaS.

Configuration (api/config.py):
  - VOICEFLOW_API_URL  — base URL of the VoiceFlow SaaS
  - VOICEFLOW_API_KEY  — bearer token issued by VoiceFlow

Usage:
  from api.services.voiceflow_client import VoiceflowClient
  client = VoiceflowClient()
  await client.push_lead(lead)
"""

import logging
from typing import Any, Optional

import httpx

from api.config import settings

logger = logging.getLogger(__name__)


class VoiceflowError(Exception):
    """Raised when the VoiceFlow API returns an error or is unreachable."""


class VoiceflowClient:
    """Thin async client for the VoiceFlow SaaS."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_sec: float = 15.0,
    ) -> None:
        self.base_url = (base_url or settings.VOICEFLOW_API_URL).rstrip("/")
        self.api_key = api_key or settings.VOICEFLOW_API_KEY
        self.timeout_sec = timeout_sec

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def push_lead(self, lead: dict[str, Any], agent_id: Optional[str] = None) -> dict[str, Any]:
        """Push a lead to VoiceFlow so it can initiate a conversation.

        `lead` should at minimum contain: id, phone, first_name, last_name, email.
        Returns the JSON response from VoiceFlow (typically with a session_id).
        """
        if not self.base_url:
            raise VoiceflowError("VOICEFLOW_API_URL is not configured")

        payload = {
            "lead_id": str(lead.get("id")),
            "phone": lead.get("phone"),
            "first_name": lead.get("first_name"),
            "last_name": lead.get("last_name"),
            "email": lead.get("email"),
            "company": lead.get("company_name") or lead.get("company"),
            "source": lead.get("source"),
            "tags": lead.get("tags") or [],
            "metadata": {
                "lead_score": lead.get("lead_score"),
                "status": lead.get("status"),
            },
        }
        if agent_id:
            payload["agent_id"] = agent_id

        url = f"{self.base_url}/api/v1/leads"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as http:
                resp = await http.post(url, json=payload, headers=self._headers())
        except httpx.HTTPError as exc:
            logger.error("VoiceFlow push_lead network error: %s", exc)
            raise VoiceflowError(f"Network error: {exc}") from exc

        if resp.status_code >= 400:
            logger.error("VoiceFlow push_lead %s: %s", resp.status_code, resp.text)
            raise VoiceflowError(f"VoiceFlow returned {resp.status_code}: {resp.text}")

        return resp.json()

    async def get_conversation(self, session_id: str) -> dict[str, Any]:
        """Fetch a conversation's full details from VoiceFlow on demand."""
        if not self.base_url:
            raise VoiceflowError("VOICEFLOW_API_URL is not configured")

        url = f"{self.base_url}/api/v1/conversations/{session_id}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as http:
                resp = await http.get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise VoiceflowError(f"Network error: {exc}") from exc

        if resp.status_code == 404:
            raise VoiceflowError(f"Conversation {session_id} not found in VoiceFlow")
        if resp.status_code >= 400:
            raise VoiceflowError(f"VoiceFlow returned {resp.status_code}: {resp.text}")

        return resp.json()
