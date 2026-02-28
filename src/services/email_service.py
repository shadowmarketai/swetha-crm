"""
Email Campaign Service
Supports: SendGrid, AWS SES, Mailgun, SMTP
"""

import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncio
import logging
import base64
import json

logger = logging.getLogger(__name__)


class EmailProvider(str, Enum):
    SENDGRID = "sendgrid"
    AWS_SES = "aws_ses"
    MAILGUN = "mailgun"
    SMTP = "smtp"


class EmailType(str, Enum):
    TRANSACTIONAL = "transactional"
    MARKETING = "marketing"
    NOTIFICATION = "notification"


class EmailMessage:
    """Email Message Model"""
    
    def __init__(
        self,
        to: List[str],
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict]] = None,
        headers: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict] = None
    ):
        self.to = to if isinstance(to, list) else [to]
        self.subject = subject
        self.body_html = body_html
        self.body_text = body_text or self._strip_html(body_html)
        self.from_email = from_email
        self.from_name = from_name
        self.cc = cc or []
        self.bcc = bcc or []
        self.reply_to = reply_to
        self.attachments = attachments or []
        self.headers = headers or {}
        self.tags = tags or []
        self.metadata = metadata or {}
        self.created_at = datetime.utcnow()
    
    @staticmethod
    def _strip_html(html: str) -> str:
        """Simple HTML to text conversion"""
        import re
        text = re.sub(r'<[^>]+>', '', html)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def to_dict(self) -> Dict:
        return {
            "to": self.to,
            "subject": self.subject,
            "body_html": self.body_html,
            "body_text": self.body_text,
            "from_email": self.from_email,
            "from_name": self.from_name,
            "cc": self.cc,
            "bcc": self.bcc,
            "reply_to": self.reply_to,
            "tags": self.tags,
            "created_at": self.created_at.isoformat()
        }


class SendGridClient:
    """SendGrid Email API Client"""
    
    def __init__(self, api_key: str, from_email: str, from_name: str = "VoiceFlow"):
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name
        self.base_url = "https://api.sendgrid.com/v3"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _headers(self) -> Dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def send_email(self, message: EmailMessage) -> Dict:
        """Send email via SendGrid"""
        url = f"{self.base_url}/mail/send"
        
        payload = {
            "personalizations": [{
                "to": [{"email": email} for email in message.to],
                "cc": [{"email": email} for email in message.cc] if message.cc else None,
                "bcc": [{"email": email} for email in message.bcc] if message.bcc else None
            }],
            "from": {
                "email": message.from_email or self.from_email,
                "name": message.from_name or self.from_name
            },
            "subject": message.subject,
            "content": [
                {"type": "text/plain", "value": message.body_text},
                {"type": "text/html", "value": message.body_html}
            ]
        }
        
        # Remove None values
        payload["personalizations"][0] = {k: v for k, v in payload["personalizations"][0].items() if v}
        
        # Add reply-to if set
        if message.reply_to:
            payload["reply_to"] = {"email": message.reply_to}
        
        # Add attachments
        if message.attachments:
            payload["attachments"] = [
                {
                    "content": att.get("content"),  # Base64 encoded
                    "filename": att.get("filename"),
                    "type": att.get("type", "application/octet-stream")
                }
                for att in message.attachments
            ]
        
        try:
            response = await self.client.post(url, headers=self._headers(), json=payload)
            if response.status_code in [200, 202]:
                return {"success": True, "message_id": response.headers.get("X-Message-Id")}
            return {"success": False, "error": response.text, "status": response.status_code}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_template(
        self, 
        to: List[str], 
        template_id: str, 
        dynamic_data: Dict
    ) -> Dict:
        """Send templated email"""
        url = f"{self.base_url}/mail/send"
        
        payload = {
            "personalizations": [{
                "to": [{"email": email} for email in to],
                "dynamic_template_data": dynamic_data
            }],
            "from": {"email": self.from_email, "name": self.from_name},
            "template_id": template_id
        }
        
        try:
            response = await self.client.post(url, headers=self._headers(), json=payload)
            if response.status_code in [200, 202]:
                return {"success": True}
            return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}


class MailgunClient:
    """Mailgun Email API Client"""
    
    def __init__(self, api_key: str, domain: str, from_email: str, from_name: str = "VoiceFlow"):
        self.api_key = api_key
        self.domain = domain
        self.from_email = from_email
        self.from_name = from_name
        self.base_url = f"https://api.mailgun.net/v3/{domain}"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def send_email(self, message: EmailMessage) -> Dict:
        """Send email via Mailgun"""
        url = f"{self.base_url}/messages"
        
        data = {
            "from": f"{message.from_name or self.from_name} <{message.from_email or self.from_email}>",
            "to": message.to,
            "subject": message.subject,
            "text": message.body_text,
            "html": message.body_html
        }
        
        if message.cc:
            data["cc"] = message.cc
        if message.bcc:
            data["bcc"] = message.bcc
        if message.reply_to:
            data["h:Reply-To"] = message.reply_to
        if message.tags:
            data["o:tag"] = message.tags
        
        try:
            response = await self.client.post(
                url,
                auth=("api", self.api_key),
                data=data
            )
            if response.status_code == 200:
                result = response.json()
                return {"success": True, "message_id": result.get("id")}
            return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}


class SMTPClient:
    """Generic SMTP Email Client"""
    
    def __init__(
        self, 
        host: str, 
        port: int, 
        username: str, 
        password: str,
        from_email: str,
        from_name: str = "VoiceFlow",
        use_tls: bool = True
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email
        self.from_name = from_name
        self.use_tls = use_tls
    
    async def send_email(self, message: EmailMessage) -> Dict:
        """Send email via SMTP"""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = message.subject
            msg["From"] = f"{message.from_name or self.from_name} <{message.from_email or self.from_email}>"
            msg["To"] = ", ".join(message.to)
            
            if message.cc:
                msg["Cc"] = ", ".join(message.cc)
            if message.reply_to:
                msg["Reply-To"] = message.reply_to
            
            # Attach text and HTML parts
            msg.attach(MIMEText(message.body_text, "plain"))
            msg.attach(MIMEText(message.body_html, "html"))
            
            # Handle attachments
            for att in message.attachments:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(base64.b64decode(att["content"]))
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{att["filename"]}"')
                msg.attach(part)
            
            # Send via SMTP
            all_recipients = message.to + message.cc + message.bcc
            
            if self.use_tls:
                server = smtplib.SMTP(self.host, self.port)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(self.host, self.port)
            
            server.login(self.username, self.password)
            server.sendmail(self.from_email, all_recipients, msg.as_string())
            server.quit()
            
            return {"success": True, "message": "Email sent successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class EmailService:
    """Unified Email Service"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.clients = {}
        self.default_provider = config.get("default_provider", "sendgrid")
        self._init_clients()
    
    def _init_clients(self):
        if "sendgrid" in self.config:
            self.clients["sendgrid"] = SendGridClient(
                self.config["sendgrid"]["api_key"],
                self.config["sendgrid"]["from_email"],
                self.config["sendgrid"].get("from_name", "VoiceFlow")
            )
        if "mailgun" in self.config:
            self.clients["mailgun"] = MailgunClient(
                self.config["mailgun"]["api_key"],
                self.config["mailgun"]["domain"],
                self.config["mailgun"]["from_email"],
                self.config["mailgun"].get("from_name", "VoiceFlow")
            )
        if "smtp" in self.config:
            self.clients["smtp"] = SMTPClient(
                self.config["smtp"]["host"],
                self.config["smtp"]["port"],
                self.config["smtp"]["username"],
                self.config["smtp"]["password"],
                self.config["smtp"]["from_email"],
                self.config["smtp"].get("from_name", "VoiceFlow"),
                self.config["smtp"].get("use_tls", True)
            )
    
    async def send_email(
        self,
        to: List[str],
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        provider: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """Send email"""
        provider = provider or self.default_provider
        
        if provider not in self.clients:
            return {"success": False, "error": f"Provider {provider} not configured"}
        
        message = EmailMessage(
            to=to,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            **kwargs
        )
        
        return await self.clients[provider].send_email(message)
    
    async def send_campaign(
        self,
        recipients: List[Dict],  # [{"email": "...", "name": "...", "data": {...}}]
        subject_template: str,
        body_html_template: str,
        provider: Optional[str] = None,
        delay_ms: int = 100
    ) -> Dict:
        """Send email campaign with personalization"""
        results = []
        
        for recipient in recipients:
            # Personalize subject and body
            subject = subject_template
            body = body_html_template
            
            for key, value in recipient.get("data", {}).items():
                subject = subject.replace(f"{{{{{key}}}}}", str(value))
                body = body.replace(f"{{{{{key}}}}}", str(value))
            
            result = await self.send_email(
                to=[recipient["email"]],
                subject=subject,
                body_html=body,
                provider=provider
            )
            
            results.append({
                "email": recipient["email"],
                **result
            })
            
            await asyncio.sleep(delay_ms / 1000)
        
        return {
            "sent": len([r for r in results if r.get("success")]),
            "failed": len([r for r in results if not r.get("success")]),
            "results": results
        }


# Pre-built Email Templates
EMAIL_TEMPLATES = {
    "welcome": {
        "subject": "Welcome to {{company_name}}! 🎉",
        "body": """
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4F46E5;">Welcome, {{name}}!</h1>
            <p>Thank you for joining {{company_name}}. We're excited to have you!</p>
            <p>Here are some quick links to get started:</p>
            <ul>
                <li><a href="{{dashboard_link}}">Your Dashboard</a></li>
                <li><a href="{{help_link}}">Help Center</a></li>
            </ul>
            <p>Best regards,<br>The {{company_name}} Team</p>
        </body>
        </html>
        """
    },
    "lead_notification": {
        "subject": "🔔 New Lead: {{lead_name}}",
        "body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>New Lead Received!</h2>
            <table style="border-collapse: collapse; width: 100%;">
                <tr><td><strong>Name:</strong></td><td>{{lead_name}}</td></tr>
                <tr><td><strong>Phone:</strong></td><td>{{lead_phone}}</td></tr>
                <tr><td><strong>Email:</strong></td><td>{{lead_email}}</td></tr>
                <tr><td><strong>Product:</strong></td><td>{{product}}</td></tr>
                <tr><td><strong>Source:</strong></td><td>{{source}}</td></tr>
            </table>
            <p><a href="{{crm_link}}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in CRM</a></p>
        </body>
        </html>
        """
    },
    "call_summary": {
        "subject": "📞 Call Summary: {{customer_name}}",
        "body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Call Summary</h2>
            <p><strong>Customer:</strong> {{customer_name}}</p>
            <p><strong>Duration:</strong> {{duration}}</p>
            <p><strong>Outcome:</strong> {{outcome}}</p>
            <h3>Summary:</h3>
            <p>{{summary}}</p>
            <h3>Next Steps:</h3>
            <p>{{next_steps}}</p>
            <p><a href="{{recording_link}}">Listen to Recording</a></p>
        </body>
        </html>
        """
    },
    "daily_report": {
        "subject": "📊 Daily Report - {{date}}",
        "body": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h1>Daily Report - {{date}}</h1>
            <h2>Summary</h2>
            <table style="border-collapse: collapse; width: 100%; border: 1px solid #ddd;">
                <tr style="background: #f5f5f5;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Calls</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">{{total_calls}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Successful</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">{{successful_calls}}</td>
                </tr>
                <tr style="background: #f5f5f5;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>New Leads</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">{{new_leads}}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Conversions</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">{{conversions}}</td>
                </tr>
            </table>
            <p><a href="{{dashboard_link}}">View Full Dashboard</a></p>
        </body>
        </html>
        """
    }
}
