"""
VoiceFlow Marketing AI - Marketing Integrations
================================================
Integrations with:
- Meta (Facebook) Ads
- Google Ads
- WhatsApp Business API
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import httpx
import os
import json


class AudienceType(Enum):
    """Types of marketing audiences"""
    CUSTOM = "custom"
    LOOKALIKE = "lookalike"
    RETARGET = "retarget"
    WIN_BACK = "win_back"


class CampaignObjective(Enum):
    """Campaign objectives"""
    AWARENESS = "awareness"
    TRAFFIC = "traffic"
    ENGAGEMENT = "engagement"
    LEADS = "leads"
    CONVERSIONS = "conversions"
    SALES = "sales"


@dataclass
class AudienceSegment:
    """Audience segment for marketing"""
    id: Optional[str] = None
    name: str = ""
    description: str = ""
    audience_type: AudienceType = AudienceType.CUSTOM
    
    # Voice-based criteria
    emotions: List[str] = None
    intents: List[str] = None
    dialects: List[str] = None
    sentiment_range: tuple = (-1.0, 1.0)
    lead_score_range: tuple = (0, 100)
    
    # Size
    estimated_size: int = 0
    
    # Metadata
    created_at: str = None
    
    def __post_init__(self):
        if self.emotions is None:
            self.emotions = []
        if self.intents is None:
            self.intents = []
        if self.dialects is None:
            self.dialects = []
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class MarketingActionResult:
    """Result of marketing action"""
    success: bool
    platform: str
    action_type: str
    resource_id: Optional[str] = None
    message: Optional[str] = None
    raw_response: Optional[Dict] = None


class MarketingIntegration(ABC):
    """Abstract base class for marketing integrations"""
    
    @abstractmethod
    async def create_audience(self, segment: AudienceSegment) -> MarketingActionResult:
        """Create a custom audience"""
        pass
    
    @abstractmethod
    async def add_to_audience(self, audience_id: str, user_data: Dict) -> MarketingActionResult:
        """Add users to an audience"""
        pass
    
    @abstractmethod
    async def create_campaign(self, name: str, objective: CampaignObjective, 
                             audience_id: str, budget: float) -> MarketingActionResult:
        """Create a marketing campaign"""
        pass


class MetaAdsIntegration(MarketingIntegration):
    """
    Meta (Facebook) Ads Integration
    
    Requires:
    - META_ACCESS_TOKEN
    - META_AD_ACCOUNT_ID
    - META_APP_SECRET (for hashing)
    """
    
    def __init__(self):
        self.access_token = os.getenv("META_ACCESS_TOKEN")
        self.ad_account_id = os.getenv("META_AD_ACCOUNT_ID")
        self.app_secret = os.getenv("META_APP_SECRET")
        self.base_url = "https://graph.facebook.com/v18.0"
    
    async def create_audience(self, segment: AudienceSegment) -> MarketingActionResult:
        """Create custom audience in Meta Ads"""
        try:
            # Create audience description based on voice criteria
            description = f"Voice AI Segment: "
            if segment.emotions:
                description += f"Emotions: {', '.join(segment.emotions)}. "
            if segment.intents:
                description += f"Intents: {', '.join(segment.intents)}. "
            if segment.dialects:
                description += f"Dialects: {', '.join(segment.dialects)}. "
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/act_{self.ad_account_id}/customaudiences",
                    params={"access_token": self.access_token},
                    json={
                        "name": segment.name,
                        "description": description[:1000],
                        "subtype": "CUSTOM",
                        "customer_file_source": "USER_PROVIDED_ONLY"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="meta",
                        action_type="create_audience",
                        resource_id=data.get("id"),
                        message="Custom audience created",
                        raw_response=data
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="meta",
                        action_type="create_audience",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="meta",
                action_type="create_audience",
                message=str(e)
            )
    
    async def add_to_audience(self, audience_id: str, user_data: Dict) -> MarketingActionResult:
        """Add users to Meta custom audience"""
        import hashlib
        
        try:
            # Hash user data for privacy
            hashed_data = []
            
            if "phone" in user_data:
                phone = user_data["phone"].replace("+", "").replace(" ", "")
                hashed_phone = hashlib.sha256(phone.encode()).hexdigest()
                hashed_data.append(["PHONE", hashed_phone])
            
            if "email" in user_data:
                email = user_data["email"].lower().strip()
                hashed_email = hashlib.sha256(email.encode()).hexdigest()
                hashed_data.append(["EMAIL", hashed_email])
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/{audience_id}/users",
                    params={"access_token": self.access_token},
                    json={
                        "payload": {
                            "schema": ["PHONE", "EMAIL"],
                            "data": hashed_data
                        }
                    }
                )
                
                if response.status_code == 200:
                    return MarketingActionResult(
                        success=True,
                        platform="meta",
                        action_type="add_to_audience",
                        resource_id=audience_id,
                        message="User added to audience"
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="meta",
                        action_type="add_to_audience",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="meta",
                action_type="add_to_audience",
                message=str(e)
            )
    
    async def create_campaign(self, name: str, objective: CampaignObjective,
                             audience_id: str, budget: float) -> MarketingActionResult:
        """Create a campaign in Meta Ads"""
        try:
            # Map objectives
            meta_objectives = {
                CampaignObjective.AWARENESS: "OUTCOME_AWARENESS",
                CampaignObjective.TRAFFIC: "OUTCOME_TRAFFIC",
                CampaignObjective.ENGAGEMENT: "OUTCOME_ENGAGEMENT",
                CampaignObjective.LEADS: "OUTCOME_LEADS",
                CampaignObjective.CONVERSIONS: "OUTCOME_SALES",
                CampaignObjective.SALES: "OUTCOME_SALES"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/act_{self.ad_account_id}/campaigns",
                    params={"access_token": self.access_token},
                    json={
                        "name": name,
                        "objective": meta_objectives.get(objective, "OUTCOME_TRAFFIC"),
                        "status": "PAUSED",
                        "special_ad_categories": []
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="meta",
                        action_type="create_campaign",
                        resource_id=data.get("id"),
                        message="Campaign created (paused)",
                        raw_response=data
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="meta",
                        action_type="create_campaign",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="meta",
                action_type="create_campaign",
                message=str(e)
            )
    
    async def create_retarget_audience(
        self,
        name: str,
        emotion: str,
        intent: str,
        dialect: str = None
    ) -> MarketingActionResult:
        """
        Create a retargeting audience based on voice analysis
        """
        segment = AudienceSegment(
            name=f"VoiceAI_Retarget_{name}",
            description=f"Retargeting: {emotion} customers with {intent} intent",
            audience_type=AudienceType.RETARGET,
            emotions=[emotion] if emotion else [],
            intents=[intent] if intent else [],
            dialects=[dialect] if dialect else []
        )
        
        return await self.create_audience(segment)


class GoogleAdsIntegration(MarketingIntegration):
    """
    Google Ads Integration
    
    Requires:
    - GOOGLE_ADS_DEVELOPER_TOKEN
    - GOOGLE_ADS_CLIENT_ID
    - GOOGLE_ADS_CLIENT_SECRET
    - GOOGLE_ADS_REFRESH_TOKEN
    - GOOGLE_ADS_CUSTOMER_ID
    """
    
    def __init__(self):
        self.developer_token = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN")
        self.client_id = os.getenv("GOOGLE_ADS_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_ADS_CLIENT_SECRET")
        self.refresh_token = os.getenv("GOOGLE_ADS_REFRESH_TOKEN")
        self.customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID")
        self.access_token = None
    
    async def _get_access_token(self) -> str:
        """Get or refresh access token"""
        if self.access_token:
            return self.access_token
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": self.refresh_token
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                return self.access_token
            else:
                raise Exception(f"Failed to get Google access token: {response.text}")
    
    async def create_audience(self, segment: AudienceSegment) -> MarketingActionResult:
        """Create customer list in Google Ads"""
        try:
            token = await self._get_access_token()
            
            # Google Ads API uses a different format
            # This is a simplified version
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://googleads.googleapis.com/v14/customers/{self.customer_id}/userLists:mutate",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "developer-token": self.developer_token,
                        "Content-Type": "application/json"
                    },
                    json={
                        "operations": [{
                            "create": {
                                "name": segment.name,
                                "description": segment.description[:2000],
                                "membershipStatus": "OPEN",
                                "membershipLifeSpan": 30,
                                "crmBasedUserList": {
                                    "uploadKeyType": "CONTACT_INFO"
                                }
                            }
                        }]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="google",
                        action_type="create_audience",
                        resource_id=data.get("results", [{}])[0].get("resourceName"),
                        message="Customer list created",
                        raw_response=data
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="google",
                        action_type="create_audience",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="google",
                action_type="create_audience",
                message=str(e)
            )
    
    async def add_to_audience(self, audience_id: str, user_data: Dict) -> MarketingActionResult:
        """Add users to Google Ads customer list"""
        import hashlib
        
        try:
            token = await self._get_access_token()
            
            # Hash user data
            operations = []
            
            if "phone" in user_data:
                phone = user_data["phone"].replace("+", "").replace(" ", "")
                hashed_phone = hashlib.sha256(phone.encode()).hexdigest()
                operations.append({
                    "create": {
                        "userIdentifiers": [{
                            "hashedPhoneNumber": hashed_phone
                        }]
                    }
                })
            
            if "email" in user_data:
                email = user_data["email"].lower().strip()
                hashed_email = hashlib.sha256(email.encode()).hexdigest()
                operations.append({
                    "create": {
                        "userIdentifiers": [{
                            "hashedEmail": hashed_email
                        }]
                    }
                })
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://googleads.googleapis.com/v14/{audience_id}:mutateMembers",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "developer-token": self.developer_token,
                        "Content-Type": "application/json"
                    },
                    json={"operations": operations}
                )
                
                if response.status_code == 200:
                    return MarketingActionResult(
                        success=True,
                        platform="google",
                        action_type="add_to_audience",
                        resource_id=audience_id,
                        message="User added to customer list"
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="google",
                        action_type="add_to_audience",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="google",
                action_type="add_to_audience",
                message=str(e)
            )
    
    async def create_campaign(self, name: str, objective: CampaignObjective,
                             audience_id: str, budget: float) -> MarketingActionResult:
        """Create a campaign in Google Ads"""
        try:
            token = await self._get_access_token()
            
            # Map objectives to Google Ads types
            ad_types = {
                CampaignObjective.AWARENESS: "DISPLAY_STANDARD",
                CampaignObjective.TRAFFIC: "SEARCH_STANDARD",
                CampaignObjective.CONVERSIONS: "PERFORMANCE_MAX"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://googleads.googleapis.com/v14/customers/{self.customer_id}/campaigns:mutate",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "developer-token": self.developer_token,
                        "Content-Type": "application/json"
                    },
                    json={
                        "operations": [{
                            "create": {
                                "name": name,
                                "advertisingChannelType": ad_types.get(objective, "SEARCH_STANDARD"),
                                "status": "PAUSED",
                                "campaignBudget": f"customers/{self.customer_id}/campaignBudgets/0"
                            }
                        }]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="google",
                        action_type="create_campaign",
                        resource_id=data.get("results", [{}])[0].get("resourceName"),
                        message="Campaign created (paused)",
                        raw_response=data
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="google",
                        action_type="create_campaign",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="google",
                action_type="create_campaign",
                message=str(e)
            )


class WhatsAppBusinessIntegration:
    """
    WhatsApp Business API Integration
    
    Requires:
    - WHATSAPP_ACCESS_TOKEN
    - WHATSAPP_PHONE_NUMBER_ID
    - WHATSAPP_BUSINESS_ACCOUNT_ID
    """
    
    def __init__(self):
        self.access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        self.business_account_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
        self.base_url = "https://graph.facebook.com/v18.0"
    
    async def send_template_message(
        self,
        to: str,
        template_name: str,
        language: str = "en",
        components: List[Dict] = None
    ) -> MarketingActionResult:
        """Send a template message via WhatsApp"""
        try:
            message_data = {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": language}
                }
            }
            
            if components:
                message_data["template"]["components"] = components
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/{self.phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json=message_data
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="whatsapp",
                        action_type="send_template",
                        resource_id=data.get("messages", [{}])[0].get("id"),
                        message="Template message sent",
                        raw_response=data
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="whatsapp",
                        action_type="send_template",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="whatsapp",
                action_type="send_template",
                message=str(e)
            )
    
    async def send_text_message(self, to: str, text: str) -> MarketingActionResult:
        """Send a text message via WhatsApp"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/{self.phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": to,
                        "type": "text",
                        "text": {"body": text}
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="whatsapp",
                        action_type="send_text",
                        resource_id=data.get("messages", [{}])[0].get("id"),
                        message="Text message sent"
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="whatsapp",
                        action_type="send_text",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="whatsapp",
                action_type="send_text",
                message=str(e)
            )
    
    async def send_voice_response(
        self,
        to: str,
        audio_url: str
    ) -> MarketingActionResult:
        """Send a voice message response"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/{self.phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": to,
                        "type": "audio",
                        "audio": {"link": audio_url}
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MarketingActionResult(
                        success=True,
                        platform="whatsapp",
                        action_type="send_audio",
                        resource_id=data.get("messages", [{}])[0].get("id"),
                        message="Audio message sent"
                    )
                else:
                    return MarketingActionResult(
                        success=False,
                        platform="whatsapp",
                        action_type="send_audio",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return MarketingActionResult(
                success=False,
                platform="whatsapp",
                action_type="send_audio",
                message=str(e)
            )


class MarketingFactory:
    """Factory for creating marketing integrations"""
    
    @staticmethod
    def get_integration(platform: str):
        """Get marketing integration by platform"""
        integrations = {
            "meta": MetaAdsIntegration,
            "google": GoogleAdsIntegration,
            "whatsapp": WhatsAppBusinessIntegration
        }
        
        if platform not in integrations:
            raise ValueError(f"Unsupported platform: {platform}")
        
        return integrations[platform]()


# Voice-triggered marketing actions
async def trigger_emotion_based_retarget(
    voice_result: Dict[str, Any],
    user_phone: str,
    platform: str = "meta"
) -> MarketingActionResult:
    """
    Trigger retargeting based on customer emotion
    
    Args:
        voice_result: Voice analysis result
        user_phone: Customer phone number
        platform: Marketing platform (meta, google)
    
    Returns:
        MarketingActionResult
    """
    emotion = voice_result.get("emotion", "neutral")
    intent = voice_result.get("intent", "inquiry")
    
    # Determine action based on emotion + intent
    if emotion in ["frustrated", "angry"] and intent in ["cancel", "complaint"]:
        # Win-back campaign
        segment = AudienceSegment(
            name=f"VoiceAI_WinBack_{datetime.now().strftime('%Y%m%d')}",
            audience_type=AudienceType.WIN_BACK,
            emotions=[emotion],
            intents=[intent]
        )
    elif emotion in ["happy", "excited"] and intent == "purchase":
        # Upsell campaign
        segment = AudienceSegment(
            name=f"VoiceAI_Upsell_{datetime.now().strftime('%Y%m%d')}",
            audience_type=AudienceType.RETARGET,
            emotions=[emotion],
            intents=[intent]
        )
    else:
        # Standard retarget
        segment = AudienceSegment(
            name=f"VoiceAI_Retarget_{datetime.now().strftime('%Y%m%d')}",
            audience_type=AudienceType.RETARGET,
            emotions=[emotion],
            intents=[intent]
        )
    
    integration = MarketingFactory.get_integration(platform)
    result = await integration.create_audience(segment)
    
    if result.success:
        # Add user to audience
        await integration.add_to_audience(
            result.resource_id,
            {"phone": user_phone}
        )
    
    return result
