"""
WhatsApp Integration Service
Supports: WATI, Gupshup, Twilio WhatsApp
"""

import httpx
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)


class WhatsAppProvider(str, Enum):
    WATI = "wati"
    GUPSHUP = "gupshup"
    TWILIO = "twilio"


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"
    TEMPLATE = "template"
    INTERACTIVE = "interactive"


class WATIClient:
    """WATI WhatsApp Business API Client"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.wati.io"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _headers(self) -> Dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
    
    @staticmethod
    def normalize_phone(phone: str) -> str:
        phone = ''.join(filter(str.isdigit, phone))
        if not phone.startswith('91') and len(phone) == 10:
            phone = '91' + phone
        return phone
    
    async def send_message(self, phone: str, text: str) -> Dict:
        url = f"{self.base_url}/api/v1/sendSessionMessage/{self.normalize_phone(phone)}"
        try:
            response = await self.client.post(url, headers=self._headers(), json={"messageText": text})
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_template(self, phone: str, template_name: str, params: List[str]) -> Dict:
        url = f"{self.base_url}/api/v1/sendTemplateMessage"
        payload = {
            "whatsappNumber": self.normalize_phone(phone),
            "template_name": template_name,
            "broadcast_name": f"broadcast_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "parameters": [{"name": f"param{i+1}", "value": p} for i, p in enumerate(params)]
        }
        try:
            response = await self.client.post(url, headers=self._headers(), json=payload)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_media(self, phone: str, media_url: str, caption: str = "") -> Dict:
        url = f"{self.base_url}/api/v1/sendSessionFile/{self.normalize_phone(phone)}"
        try:
            response = await self.client.post(url, headers=self._headers(), json={"url": media_url, "caption": caption})
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_contacts(self, page_size: int = 100) -> Dict:
        url = f"{self.base_url}/api/v1/getContacts"
        try:
            response = await self.client.get(url, headers=self._headers(), params={"pageSize": page_size})
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}


class GupshupClient:
    """Gupshup WhatsApp Business API Client"""
    
    def __init__(self, api_key: str, app_name: str, source_phone: str):
        self.api_key = api_key
        self.app_name = app_name
        self.source_phone = source_phone
        self.base_url = "https://api.gupshup.io/sm/api/v1"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _headers(self) -> Dict:
        return {"apikey": self.api_key, "Content-Type": "application/x-www-form-urlencoded"}
    
    @staticmethod
    def normalize_phone(phone: str) -> str:
        phone = ''.join(filter(str.isdigit, phone))
        if not phone.startswith('91') and len(phone) == 10:
            phone = '91' + phone
        return phone
    
    async def send_message(self, phone: str, text: str) -> Dict:
        url = f"{self.base_url}/msg"
        payload = {
            "channel": "whatsapp",
            "source": self.source_phone,
            "destination": self.normalize_phone(phone),
            "message": json.dumps({"type": "text", "text": text}),
            "src.name": self.app_name
        }
        try:
            response = await self.client.post(url, headers=self._headers(), data=payload)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_template(self, phone: str, template_id: str, params: List[str]) -> Dict:
        url = f"{self.base_url}/template/msg"
        payload = {
            "channel": "whatsapp",
            "source": self.source_phone,
            "destination": self.normalize_phone(phone),
            "template": json.dumps({"id": template_id, "params": params}),
            "src.name": self.app_name
        }
        try:
            response = await self.client.post(url, headers=self._headers(), data=payload)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_interactive(self, phone: str, body_text: str, buttons: List[Dict]) -> Dict:
        url = f"{self.base_url}/msg"
        message = {
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {"buttons": [{"type": "reply", "reply": {"id": b["id"], "title": b["title"]}} for b in buttons[:3]]}
            }
        }
        payload = {
            "channel": "whatsapp",
            "source": self.source_phone,
            "destination": self.normalize_phone(phone),
            "message": json.dumps(message),
            "src.name": self.app_name
        }
        try:
            response = await self.client.post(url, headers=self._headers(), data=payload)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}


class WhatsAppService:
    """Unified WhatsApp Service with multi-provider support"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.clients = {}
        self._init_clients()
    
    def _init_clients(self):
        if "wati" in self.config:
            self.clients["wati"] = WATIClient(self.config["wati"]["api_key"], self.config["wati"].get("base_url", "https://api.wati.io"))
        if "gupshup" in self.config:
            self.clients["gupshup"] = GupshupClient(self.config["gupshup"]["api_key"], self.config["gupshup"]["app_name"], self.config["gupshup"]["source_phone"])
    
    async def send_message(self, phone: str, text: str, provider: str = "wati") -> Dict:
        if provider not in self.clients:
            return {"success": False, "error": f"Provider {provider} not configured"}
        return await self.clients[provider].send_message(phone, text)
    
    async def send_template(self, phone: str, template: str, params: List[str], provider: str = "wati") -> Dict:
        if provider not in self.clients:
            return {"success": False, "error": f"Provider {provider} not configured"}
        return await self.clients[provider].send_template(phone, template, params)
    
    async def send_bulk(self, phones: List[str], text: str, provider: str = "wati", delay_ms: int = 100) -> List[Dict]:
        results = []
        for phone in phones:
            result = await self.send_message(phone, text, provider)
            results.append({"phone": phone, **result})
            await asyncio.sleep(delay_ms / 1000)
        return results


# Pre-built Templates for Indian SMBs
WHATSAPP_TEMPLATES = {
    "lead_followup": {"name": "lead_followup", "params": ["customer_name", "product_name"]},
    "appointment_reminder": {"name": "appointment_reminder", "params": ["customer_name", "date", "time"]},
    "payment_reminder": {"name": "payment_reminder", "params": ["customer_name", "amount", "due_date", "payment_link"]},
    "order_confirmation": {"name": "order_confirmation", "params": ["customer_name", "order_id", "tracking_link"]},
    "missed_call_followup": {"name": "missed_call_followup", "params": ["customer_name"]},
}
