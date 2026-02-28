"""
SMS Campaign Service
Supports: MSG91, Twilio, TextLocal
Includes: DND Registry Check for India
"""

import httpx
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import asyncio
import logging
import re

logger = logging.getLogger(__name__)


class SMSProvider(str, Enum):
    MSG91 = "msg91"
    TWILIO = "twilio"
    TEXTLOCAL = "textlocal"


class SMSType(str, Enum):
    TRANSACTIONAL = "transactional"
    PROMOTIONAL = "promotional"
    OTP = "otp"


class MSG91Client:
    """MSG91 SMS API Client - Popular in India"""
    
    def __init__(self, auth_key: str, sender_id: str, route: str = "4"):
        self.auth_key = auth_key
        self.sender_id = sender_id
        self.route = route  # 1=Promotional, 4=Transactional, 5=OTP
        self.base_url = "https://api.msg91.com/api/v5"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _headers(self) -> Dict:
        return {"authkey": self.auth_key, "Content-Type": "application/json"}
    
    @staticmethod
    def normalize_phone(phone: str) -> str:
        phone = ''.join(filter(str.isdigit, phone))
        if not phone.startswith('91') and len(phone) == 10:
            phone = '91' + phone
        return phone
    
    async def send_sms(self, phone: str, message: str, template_id: Optional[str] = None) -> Dict:
        """Send single SMS"""
        url = f"{self.base_url}/flow/"
        
        payload = {
            "template_id": template_id or "default",
            "sender": self.sender_id,
            "mobiles": self.normalize_phone(phone),
            "VAR1": message
        }
        
        try:
            response = await self.client.post(url, headers=self._headers(), json=payload)
            return {"success": True, "data": response.json(), "phone": phone}
        except Exception as e:
            return {"success": False, "error": str(e), "phone": phone}
    
    async def send_bulk(self, recipients: List[Dict[str, str]], template_id: str) -> Dict:
        """Send bulk SMS with variables"""
        url = f"{self.base_url}/flow/"
        
        payload = {
            "template_id": template_id,
            "sender": self.sender_id,
            "recipients": [
                {"mobiles": self.normalize_phone(r["phone"]), **{k: v for k, v in r.items() if k != "phone"}}
                for r in recipients
            ]
        }
        
        try:
            response = await self.client.post(url, headers=self._headers(), json=payload)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_otp(self, phone: str, otp_length: int = 6) -> Dict:
        """Send OTP via MSG91"""
        url = f"{self.base_url}/otp"
        
        params = {
            "authkey": self.auth_key,
            "mobile": self.normalize_phone(phone),
            "sender": self.sender_id,
            "otp_length": otp_length
        }
        
        try:
            response = await self.client.get(url, params=params)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def verify_otp(self, phone: str, otp: str) -> Dict:
        """Verify OTP"""
        url = f"{self.base_url}/otp/verify"
        
        params = {
            "authkey": self.auth_key,
            "mobile": self.normalize_phone(phone),
            "otp": otp
        }
        
        try:
            response = await self.client.get(url, params=params)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_balance(self) -> Dict:
        """Get account balance"""
        url = f"{self.base_url}/balance.php"
        params = {"authkey": self.auth_key, "type": self.route}
        
        try:
            response = await self.client.get(url, params=params)
            return {"success": True, "balance": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}


class TwilioSMSClient:
    """Twilio SMS API Client"""
    
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    @staticmethod
    def normalize_phone(phone: str) -> str:
        phone = ''.join(filter(str.isdigit, phone))
        if not phone.startswith('+'):
            if len(phone) == 10:
                phone = '+91' + phone
            else:
                phone = '+' + phone
        return phone
    
    async def send_sms(self, phone: str, message: str) -> Dict:
        """Send single SMS"""
        url = f"{self.base_url}/Messages.json"
        
        payload = {
            "From": self.from_number,
            "To": self.normalize_phone(phone),
            "Body": message
        }
        
        try:
            response = await self.client.post(
                url, 
                auth=(self.account_sid, self.auth_token),
                data=payload
            )
            return {"success": True, "data": response.json(), "phone": phone}
        except Exception as e:
            return {"success": False, "error": str(e), "phone": phone}
    
    async def send_bulk(self, phones: List[str], message: str, delay_ms: int = 100) -> List[Dict]:
        """Send bulk SMS with rate limiting"""
        results = []
        for phone in phones:
            result = await self.send_sms(phone, message)
            results.append(result)
            await asyncio.sleep(delay_ms / 1000)
        return results


class TextLocalClient:
    """TextLocal SMS API Client - Popular in India"""
    
    def __init__(self, api_key: str, sender: str):
        self.api_key = api_key
        self.sender = sender
        self.base_url = "https://api.textlocal.in"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    @staticmethod
    def normalize_phone(phone: str) -> str:
        phone = ''.join(filter(str.isdigit, phone))
        if not phone.startswith('91') and len(phone) == 10:
            phone = '91' + phone
        return phone
    
    async def send_sms(self, phone: str, message: str) -> Dict:
        """Send single SMS"""
        url = f"{self.base_url}/send/"
        
        payload = {
            "apikey": self.api_key,
            "numbers": self.normalize_phone(phone),
            "message": message,
            "sender": self.sender
        }
        
        try:
            response = await self.client.post(url, data=payload)
            return {"success": True, "data": response.json(), "phone": phone}
        except Exception as e:
            return {"success": False, "error": str(e), "phone": phone}
    
    async def get_balance(self) -> Dict:
        """Get account balance"""
        url = f"{self.base_url}/balance/"
        params = {"apikey": self.api_key}
        
        try:
            response = await self.client.get(url, params=params)
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}


class DNDChecker:
    """
    DND (Do Not Disturb) Registry Checker for India
    Checks if a number is registered in TRAI's DND registry
    """
    
    # DND Category Codes
    DND_CATEGORIES = {
        0: "No DND - All messages allowed",
        1: "Fully blocked",
        2: "Banking/Insurance/Financial products blocked",
        3: "Real Estate blocked",
        4: "Education blocked",
        5: "Health blocked",
        6: "Consumer Goods blocked",
        7: "Communication/Broadcasting blocked"
    }
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=10.0)
        # Local cache for DND status
        self._cache: Dict[str, Dict] = {}
    
    @staticmethod
    def normalize_phone(phone: str) -> str:
        phone = ''.join(filter(str.isdigit, phone))
        if phone.startswith('91') and len(phone) == 12:
            phone = phone[2:]
        return phone
    
    async def check_dnd(self, phone: str) -> Dict:
        """
        Check if number is on DND registry
        Returns: {"is_dnd": bool, "category": int, "description": str}
        """
        phone = self.normalize_phone(phone)
        
        # Check cache first
        if phone in self._cache:
            return self._cache[phone]
        
        # If no API key, use pattern-based heuristics
        if not self.api_key:
            return await self._check_local(phone)
        
        # Use DND API
        try:
            url = "https://api.dndcheck.in/check"  # Example API
            response = await self.client.get(
                url,
                params={"phone": phone, "api_key": self.api_key}
            )
            data = response.json()
            
            result = {
                "is_dnd": data.get("dnd_active", False),
                "category": data.get("category", 0),
                "description": self.DND_CATEGORIES.get(data.get("category", 0), "Unknown"),
                "phone": phone
            }
            
            self._cache[phone] = result
            return result
            
        except Exception as e:
            logger.warning(f"DND check failed for {phone}: {e}")
            return {"is_dnd": False, "category": 0, "description": "Check failed", "phone": phone}
    
    async def _check_local(self, phone: str) -> Dict:
        """Local heuristic check (when no API available)"""
        # This is a placeholder - in production, maintain a local DND database
        return {
            "is_dnd": False,
            "category": 0,
            "description": "No DND API configured - assuming allowed",
            "phone": phone,
            "warning": "Please configure DND API for accurate results"
        }
    
    async def filter_non_dnd(self, phones: List[str], category: Optional[int] = None) -> Dict:
        """Filter out DND numbers from a list"""
        allowed = []
        blocked = []
        
        for phone in phones:
            result = await self.check_dnd(phone)
            if result["is_dnd"]:
                if category is None or result["category"] == category:
                    blocked.append({"phone": phone, **result})
                else:
                    allowed.append(phone)
            else:
                allowed.append(phone)
        
        return {"allowed": allowed, "blocked": blocked, "total": len(phones)}
    
    def clear_cache(self):
        """Clear DND cache"""
        self._cache.clear()


class SMSService:
    """Unified SMS Service with DND Compliance"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.clients = {}
        self.dnd_checker = DNDChecker(config.get("dnd_api_key"))
        self._init_clients()
    
    def _init_clients(self):
        if "msg91" in self.config:
            self.clients["msg91"] = MSG91Client(
                self.config["msg91"]["auth_key"],
                self.config["msg91"]["sender_id"],
                self.config["msg91"].get("route", "4")
            )
        if "twilio" in self.config:
            self.clients["twilio"] = TwilioSMSClient(
                self.config["twilio"]["account_sid"],
                self.config["twilio"]["auth_token"],
                self.config["twilio"]["from_number"]
            )
        if "textlocal" in self.config:
            self.clients["textlocal"] = TextLocalClient(
                self.config["textlocal"]["api_key"],
                self.config["textlocal"]["sender"]
            )
    
    async def send_sms(
        self, 
        phone: str, 
        message: str, 
        provider: str = "msg91",
        check_dnd: bool = True,
        sms_type: SMSType = SMSType.TRANSACTIONAL
    ) -> Dict:
        """Send SMS with optional DND check"""
        
        # DND check for promotional messages
        if check_dnd and sms_type == SMSType.PROMOTIONAL:
            dnd_result = await self.dnd_checker.check_dnd(phone)
            if dnd_result["is_dnd"]:
                return {
                    "success": False, 
                    "error": "Number is on DND registry",
                    "dnd_info": dnd_result
                }
        
        if provider not in self.clients:
            return {"success": False, "error": f"Provider {provider} not configured"}
        
        return await self.clients[provider].send_sms(phone, message)
    
    async def send_campaign(
        self,
        phones: List[str],
        message: str,
        provider: str = "msg91",
        check_dnd: bool = True,
        sms_type: SMSType = SMSType.PROMOTIONAL,
        delay_ms: int = 100
    ) -> Dict:
        """Send SMS campaign with DND filtering"""
        
        # Filter DND numbers for promotional campaigns
        if check_dnd and sms_type == SMSType.PROMOTIONAL:
            filter_result = await self.dnd_checker.filter_non_dnd(phones)
            allowed_phones = filter_result["allowed"]
            blocked = filter_result["blocked"]
        else:
            allowed_phones = phones
            blocked = []
        
        # Send to allowed numbers
        results = []
        for phone in allowed_phones:
            result = await self.send_sms(phone, message, provider, check_dnd=False)
            results.append(result)
            await asyncio.sleep(delay_ms / 1000)
        
        return {
            "sent": len([r for r in results if r.get("success")]),
            "failed": len([r for r in results if not r.get("success")]),
            "blocked_dnd": len(blocked),
            "blocked_details": blocked,
            "results": results
        }
    
    async def send_otp(self, phone: str, provider: str = "msg91") -> Dict:
        """Send OTP (always bypasses DND)"""
        if provider == "msg91" and "msg91" in self.clients:
            return await self.clients["msg91"].send_otp(phone)
        
        # Fallback: generate and send OTP
        import random
        otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        message = f"Your OTP is {otp}. Valid for 10 minutes."
        
        result = await self.send_sms(phone, message, provider, check_dnd=False, sms_type=SMSType.OTP)
        if result.get("success"):
            result["otp"] = otp  # Return OTP for verification storage
        return result
    
    async def get_balance(self, provider: str = "msg91") -> Dict:
        """Get SMS balance"""
        if provider not in self.clients:
            return {"success": False, "error": f"Provider {provider} not configured"}
        
        if hasattr(self.clients[provider], "get_balance"):
            return await self.clients[provider].get_balance()
        
        return {"success": False, "error": "Balance check not supported"}


# SMS Templates for Indian SMBs
SMS_TEMPLATES = {
    "lead_notification": "New lead: {name} ({phone}). Product: {product}. Call within 5 mins for best conversion!",
    "appointment_reminder": "Hi {name}, reminder: Your appointment is on {date} at {time}. Reply C to confirm.",
    "payment_due": "Hi {name}, your payment of Rs.{amount} is due on {date}. Pay now: {link}",
    "order_shipped": "Hi {name}, your order #{order_id} has shipped! Track: {tracking_link}",
    "feedback_request": "Hi {name}, how was your experience? Rate us: {link}. Your feedback matters!",
    "missed_call": "Hi {name}, we missed your call. Our agent will call back shortly.",
    "otp": "Your OTP is {otp}. Valid for {validity} minutes. Do not share with anyone.",
    "welcome": "Welcome to {company}! We're excited to have you. Questions? Reply to this message."
}
