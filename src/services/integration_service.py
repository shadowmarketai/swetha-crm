"""
External Integrations Service
Supports: Zapier, Make (Integromat), Slack, Google Sheets
"""

import httpx
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncio
import logging
import hashlib
import hmac

logger = logging.getLogger(__name__)


class WebhookEventType(str, Enum):
    # Lead Events
    LEAD_CREATED = "lead.created"
    LEAD_UPDATED = "lead.updated"
    LEAD_CONVERTED = "lead.converted"
    LEAD_DELETED = "lead.deleted"
    
    # Call Events
    CALL_STARTED = "call.started"
    CALL_COMPLETED = "call.completed"
    CALL_FAILED = "call.failed"
    CALL_MISSED = "call.missed"
    
    # Campaign Events
    CAMPAIGN_STARTED = "campaign.started"
    CAMPAIGN_COMPLETED = "campaign.completed"
    CAMPAIGN_PAUSED = "campaign.paused"
    
    # Survey Events
    SURVEY_SUBMITTED = "survey.submitted"
    
    # Ticket Events
    TICKET_CREATED = "ticket.created"
    TICKET_UPDATED = "ticket.updated"
    TICKET_RESOLVED = "ticket.resolved"


class WebhookService:
    """
    Webhook Service for Zapier/Make Integration
    Manages webhook subscriptions and event dispatching
    """
    
    def __init__(self, secret_key: str = "voiceflow_webhook_secret"):
        self.secret_key = secret_key
        self.client = httpx.AsyncClient(timeout=30.0)
        # In production, store in database
        self.subscriptions: Dict[str, List[Dict]] = {}
    
    def generate_signature(self, payload: str) -> str:
        """Generate HMAC signature for webhook payload"""
        return hmac.new(
            self.secret_key.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    def verify_signature(self, payload: str, signature: str) -> bool:
        """Verify webhook signature"""
        expected = self.generate_signature(payload)
        return hmac.compare_digest(expected, signature)
    
    async def subscribe(
        self,
        webhook_url: str,
        events: List[WebhookEventType],
        name: str = "Webhook",
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Subscribe to webhook events"""
        subscription = {
            "id": hashlib.md5(webhook_url.encode()).hexdigest()[:12],
            "url": webhook_url,
            "events": [e.value for e in events],
            "name": name,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "active": True
        }
        
        for event in events:
            event_key = event.value
            if event_key not in self.subscriptions:
                self.subscriptions[event_key] = []
            self.subscriptions[event_key].append(subscription)
        
        return {"success": True, "subscription": subscription}
    
    async def unsubscribe(self, subscription_id: str) -> Dict:
        """Unsubscribe from webhook events"""
        removed = False
        for event_key in self.subscriptions:
            self.subscriptions[event_key] = [
                s for s in self.subscriptions[event_key] 
                if s["id"] != subscription_id
            ]
            removed = True
        
        return {"success": removed}
    
    async def dispatch(
        self,
        event_type: WebhookEventType,
        payload: Dict
    ) -> List[Dict]:
        """Dispatch event to all subscribed webhooks"""
        event_key = event_type.value
        subscribers = self.subscriptions.get(event_key, [])
        
        if not subscribers:
            return []
        
        results = []
        event_data = {
            "event": event_key,
            "timestamp": datetime.utcnow().isoformat(),
            "data": payload
        }
        payload_str = json.dumps(event_data)
        signature = self.generate_signature(payload_str)
        
        for subscription in subscribers:
            if not subscription.get("active"):
                continue
            
            try:
                response = await self.client.post(
                    subscription["url"],
                    json=event_data,
                    headers={
                        "Content-Type": "application/json",
                        "X-VoiceFlow-Signature": signature,
                        "X-VoiceFlow-Event": event_key
                    }
                )
                
                results.append({
                    "subscription_id": subscription["id"],
                    "success": response.status_code < 400,
                    "status_code": response.status_code
                })
            except Exception as e:
                results.append({
                    "subscription_id": subscription["id"],
                    "success": False,
                    "error": str(e)
                })
        
        return results
    
    def list_subscriptions(self) -> List[Dict]:
        """List all subscriptions"""
        all_subs = {}
        for event_key, subs in self.subscriptions.items():
            for sub in subs:
                if sub["id"] not in all_subs:
                    all_subs[sub["id"]] = sub
        return list(all_subs.values())


class SlackClient:
    """Slack Integration Client"""
    
    def __init__(self, bot_token: str, default_channel: str = "#general"):
        self.bot_token = bot_token
        self.default_channel = default_channel
        self.base_url = "https://slack.com/api"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _headers(self) -> Dict:
        return {
            "Authorization": f"Bearer {self.bot_token}",
            "Content-Type": "application/json"
        }
    
    async def send_message(
        self,
        text: str,
        channel: Optional[str] = None,
        blocks: Optional[List[Dict]] = None,
        thread_ts: Optional[str] = None
    ) -> Dict:
        """Send message to Slack channel"""
        url = f"{self.base_url}/chat.postMessage"
        
        payload = {
            "channel": channel or self.default_channel,
            "text": text
        }
        
        if blocks:
            payload["blocks"] = blocks
        if thread_ts:
            payload["thread_ts"] = thread_ts
        
        try:
            response = await self.client.post(url, headers=self._headers(), json=payload)
            data = response.json()
            return {"success": data.get("ok", False), "data": data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_rich_notification(
        self,
        title: str,
        message: str,
        color: str = "#4F46E5",
        fields: Optional[List[Dict]] = None,
        channel: Optional[str] = None
    ) -> Dict:
        """Send rich formatted notification"""
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": title}
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": message}
            }
        ]
        
        if fields:
            blocks.append({
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*{f['title']}*\n{f['value']}"}
                    for f in fields
                ]
            })
        
        return await self.send_message(
            text=title,
            channel=channel,
            blocks=blocks
        )
    
    async def send_lead_notification(self, lead: Dict, channel: Optional[str] = None) -> Dict:
        """Send formatted lead notification"""
        return await self.send_rich_notification(
            title="🔔 New Lead Received!",
            message=f"A new lead has been captured.",
            color="#00C853",
            fields=[
                {"title": "Name", "value": lead.get("name", "N/A")},
                {"title": "Phone", "value": lead.get("phone", "N/A")},
                {"title": "Email", "value": lead.get("email", "N/A")},
                {"title": "Source", "value": lead.get("source", "N/A")}
            ],
            channel=channel
        )
    
    async def send_call_notification(self, call: Dict, channel: Optional[str] = None) -> Dict:
        """Send formatted call notification"""
        status_emoji = "✅" if call.get("status") == "completed" else "❌"
        return await self.send_rich_notification(
            title=f"{status_emoji} Call {call.get('status', 'unknown').title()}",
            message=f"Call with {call.get('customer_name', 'Unknown')}",
            fields=[
                {"title": "Duration", "value": call.get("duration", "N/A")},
                {"title": "Outcome", "value": call.get("outcome", "N/A")},
                {"title": "Agent", "value": call.get("agent", "AI Assistant")}
            ],
            channel=channel
        )
    
    async def upload_file(
        self,
        file_content: bytes,
        filename: str,
        channel: Optional[str] = None,
        initial_comment: Optional[str] = None
    ) -> Dict:
        """Upload file to Slack"""
        url = f"{self.base_url}/files.upload"
        
        try:
            response = await self.client.post(
                url,
                headers={"Authorization": f"Bearer {self.bot_token}"},
                files={"file": (filename, file_content)},
                data={
                    "channels": channel or self.default_channel,
                    "initial_comment": initial_comment or ""
                }
            )
            data = response.json()
            return {"success": data.get("ok", False), "data": data}
        except Exception as e:
            return {"success": False, "error": str(e)}


class GoogleSheetsClient:
    """Google Sheets Integration Client"""
    
    def __init__(self, credentials: Dict[str, Any]):
        self.credentials = credentials
        self.base_url = "https://sheets.googleapis.com/v4/spreadsheets"
        self.client = httpx.AsyncClient(timeout=30.0)
        self._access_token = None
        self._token_expires = None
    
    async def _get_access_token(self) -> str:
        """Get or refresh access token"""
        # In production, use proper OAuth2 flow
        # This is simplified for demo
        if self._access_token and self._token_expires and datetime.utcnow() < self._token_expires:
            return self._access_token
        
        # Refresh token
        url = "https://oauth2.googleapis.com/token"
        payload = {
            "client_id": self.credentials.get("client_id"),
            "client_secret": self.credentials.get("client_secret"),
            "refresh_token": self.credentials.get("refresh_token"),
            "grant_type": "refresh_token"
        }
        
        try:
            response = await self.client.post(url, data=payload)
            data = response.json()
            self._access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            self._token_expires = datetime.utcnow() + asyncio.timedelta(seconds=expires_in - 60)
            return self._access_token
        except Exception as e:
            logger.error(f"Failed to refresh Google token: {e}")
            return ""
    
    async def _headers(self) -> Dict:
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    async def append_row(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        values: List[Any]
    ) -> Dict:
        """Append a row to Google Sheet"""
        url = f"{self.base_url}/{spreadsheet_id}/values/{sheet_name}!A:Z:append"
        
        params = {
            "valueInputOption": "USER_ENTERED",
            "insertDataOption": "INSERT_ROWS"
        }
        
        payload = {
            "values": [values]
        }
        
        try:
            response = await self.client.post(
                url,
                headers=await self._headers(),
                params=params,
                json=payload
            )
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def append_lead(
        self,
        spreadsheet_id: str,
        lead: Dict,
        sheet_name: str = "Leads"
    ) -> Dict:
        """Append lead to Google Sheet"""
        values = [
            datetime.utcnow().isoformat(),
            lead.get("name", ""),
            lead.get("phone", ""),
            lead.get("email", ""),
            lead.get("source", ""),
            lead.get("status", "new"),
            lead.get("notes", "")
        ]
        
        return await self.append_row(spreadsheet_id, sheet_name, values)
    
    async def read_range(
        self,
        spreadsheet_id: str,
        range_notation: str
    ) -> Dict:
        """Read data from Google Sheet"""
        url = f"{self.base_url}/{spreadsheet_id}/values/{range_notation}"
        
        try:
            response = await self.client.get(url, headers=await self._headers())
            data = response.json()
            return {"success": True, "values": data.get("values", [])}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def update_cell(
        self,
        spreadsheet_id: str,
        range_notation: str,
        value: Any
    ) -> Dict:
        """Update a single cell"""
        url = f"{self.base_url}/{spreadsheet_id}/values/{range_notation}"
        
        params = {"valueInputOption": "USER_ENTERED"}
        payload = {"values": [[value]]}
        
        try:
            response = await self.client.put(
                url,
                headers=await self._headers(),
                params=params,
                json=payload
            )
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}


class IntegrationService:
    """Unified Integration Service"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.webhook_service = WebhookService(config.get("webhook_secret", "voiceflow"))
        self.slack_client = None
        self.sheets_client = None
        self._init_clients()
    
    def _init_clients(self):
        if "slack" in self.config:
            self.slack_client = SlackClient(
                self.config["slack"]["bot_token"],
                self.config["slack"].get("default_channel", "#general")
            )
        
        if "google_sheets" in self.config:
            self.sheets_client = GoogleSheetsClient(self.config["google_sheets"])
    
    async def on_lead_created(self, lead: Dict) -> Dict:
        """Handle lead creation - dispatch to all integrations"""
        results = {}
        
        # Dispatch webhook
        results["webhooks"] = await self.webhook_service.dispatch(
            WebhookEventType.LEAD_CREATED,
            lead
        )
        
        # Send Slack notification
        if self.slack_client:
            results["slack"] = await self.slack_client.send_lead_notification(lead)
        
        # Append to Google Sheet
        if self.sheets_client and "leads_spreadsheet_id" in self.config.get("google_sheets", {}):
            results["sheets"] = await self.sheets_client.append_lead(
                self.config["google_sheets"]["leads_spreadsheet_id"],
                lead
            )
        
        return results
    
    async def on_call_completed(self, call: Dict) -> Dict:
        """Handle call completion"""
        results = {}
        
        results["webhooks"] = await self.webhook_service.dispatch(
            WebhookEventType.CALL_COMPLETED,
            call
        )
        
        if self.slack_client:
            results["slack"] = await self.slack_client.send_call_notification(call)
        
        return results
    
    async def subscribe_webhook(
        self,
        url: str,
        events: List[str],
        name: str = "Integration"
    ) -> Dict:
        """Subscribe to webhook events"""
        event_types = [WebhookEventType(e) for e in events]
        return await self.webhook_service.subscribe(url, event_types, name)
    
    def get_available_events(self) -> List[Dict]:
        """Get list of available webhook events"""
        return [
            {"event": e.value, "description": e.name.replace("_", " ").title()}
            for e in WebhookEventType
        ]
