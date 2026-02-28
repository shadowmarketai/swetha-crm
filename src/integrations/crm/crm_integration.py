"""
VoiceFlow Marketing AI - CRM Integrations
==========================================
Integrations with:
- Zoho CRM
- HubSpot
- Salesforce (placeholder)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime
import httpx
import os
import json


@dataclass
class Lead:
    """Universal lead model"""
    id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: str = ""
    company: Optional[str] = None
    
    # Voice-specific fields
    voice_analysis_id: Optional[str] = None
    transcription: Optional[str] = None
    emotion: Optional[str] = None
    sentiment: Optional[float] = None
    intent: Optional[str] = None
    lead_score: Optional[float] = None
    dialect: Optional[str] = None
    
    # Marketing fields
    source: str = "voice_ai"
    campaign: Optional[str] = None
    
    # Timestamps
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    # Custom fields
    custom_fields: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.custom_fields is None:
            self.custom_fields = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class CRMSyncResult:
    """Result of CRM sync operation"""
    success: bool
    crm_type: str
    crm_record_id: Optional[str] = None
    operation: str = "create"
    message: Optional[str] = None
    raw_response: Optional[Dict] = None


class CRMIntegration(ABC):
    """Abstract base class for CRM integrations"""
    
    @abstractmethod
    async def create_lead(self, lead: Lead) -> CRMSyncResult:
        """Create a new lead in CRM"""
        pass
    
    @abstractmethod
    async def update_lead(self, lead_id: str, lead: Lead) -> CRMSyncResult:
        """Update an existing lead"""
        pass
    
    @abstractmethod
    async def get_lead(self, lead_id: str) -> Optional[Lead]:
        """Get a lead by ID"""
        pass
    
    @abstractmethod
    async def search_leads(self, query: str) -> List[Lead]:
        """Search for leads"""
        pass
    
    @abstractmethod
    async def add_note(self, lead_id: str, note: str) -> CRMSyncResult:
        """Add a note to a lead"""
        pass


class ZohoCRMIntegration(CRMIntegration):
    """
    Zoho CRM Integration
    
    Requires:
    - ZOHO_CLIENT_ID
    - ZOHO_CLIENT_SECRET
    - ZOHO_REFRESH_TOKEN
    """
    
    def __init__(self):
        self.client_id = os.getenv("ZOHO_CLIENT_ID")
        self.client_secret = os.getenv("ZOHO_CLIENT_SECRET")
        self.refresh_token = os.getenv("ZOHO_REFRESH_TOKEN")
        self.access_token = None
        self.base_url = "https://www.zohoapis.com/crm/v3"
    
    async def _get_access_token(self) -> str:
        """Get or refresh access token"""
        if self.access_token:
            return self.access_token
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://accounts.zoho.com/oauth/v2/token",
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
                raise Exception(f"Failed to get Zoho access token: {response.text}")
    
    def _lead_to_zoho(self, lead: Lead) -> Dict:
        """Convert Lead to Zoho format"""
        zoho_lead = {
            "First_Name": lead.first_name or "",
            "Last_Name": lead.last_name or "Unknown",
            "Email": lead.email,
            "Phone": lead.phone,
            "Company": lead.company or "Unknown",
            "Lead_Source": "Voice AI",
            "Description": lead.transcription,
            
            # Custom fields for voice data
            "Voice_Analysis_ID": lead.voice_analysis_id,
            "Customer_Emotion": lead.emotion,
            "Sentiment_Score": str(lead.sentiment) if lead.sentiment else None,
            "Customer_Intent": lead.intent,
            "Lead_Score_AI": str(lead.lead_score) if lead.lead_score else None,
            "Detected_Dialect": lead.dialect
        }
        
        # Remove None values
        return {k: v for k, v in zoho_lead.items() if v is not None}
    
    async def create_lead(self, lead: Lead) -> CRMSyncResult:
        """Create lead in Zoho CRM"""
        try:
            token = await self._get_access_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/Leads",
                    headers={
                        "Authorization": f"Zoho-oauthtoken {token}",
                        "Content-Type": "application/json"
                    },
                    json={"data": [self._lead_to_zoho(lead)]}
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    record_id = data["data"][0]["details"]["id"]
                    return CRMSyncResult(
                        success=True,
                        crm_type="zoho",
                        crm_record_id=record_id,
                        operation="create",
                        message="Lead created successfully",
                        raw_response=data
                    )
                else:
                    return CRMSyncResult(
                        success=False,
                        crm_type="zoho",
                        operation="create",
                        message=f"Failed: {response.text}",
                        raw_response=response.json() if response.text else None
                    )
        except Exception as e:
            return CRMSyncResult(
                success=False,
                crm_type="zoho",
                operation="create",
                message=str(e)
            )
    
    async def update_lead(self, lead_id: str, lead: Lead) -> CRMSyncResult:
        """Update lead in Zoho CRM"""
        try:
            token = await self._get_access_token()
            
            zoho_data = self._lead_to_zoho(lead)
            zoho_data["id"] = lead_id
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{self.base_url}/Leads",
                    headers={
                        "Authorization": f"Zoho-oauthtoken {token}",
                        "Content-Type": "application/json"
                    },
                    json={"data": [zoho_data]}
                )
                
                if response.status_code == 200:
                    return CRMSyncResult(
                        success=True,
                        crm_type="zoho",
                        crm_record_id=lead_id,
                        operation="update",
                        message="Lead updated successfully"
                    )
                else:
                    return CRMSyncResult(
                        success=False,
                        crm_type="zoho",
                        operation="update",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return CRMSyncResult(
                success=False,
                crm_type="zoho",
                operation="update",
                message=str(e)
            )
    
    async def get_lead(self, lead_id: str) -> Optional[Lead]:
        """Get lead from Zoho CRM"""
        try:
            token = await self._get_access_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/Leads/{lead_id}",
                    headers={"Authorization": f"Zoho-oauthtoken {token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()["data"][0]
                    return Lead(
                        id=data["id"],
                        first_name=data.get("First_Name"),
                        last_name=data.get("Last_Name"),
                        email=data.get("Email"),
                        phone=data.get("Phone", ""),
                        company=data.get("Company")
                    )
        except Exception:
            pass
        return None
    
    async def search_leads(self, query: str) -> List[Lead]:
        """Search leads in Zoho CRM"""
        try:
            token = await self._get_access_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/Leads/search",
                    headers={"Authorization": f"Zoho-oauthtoken {token}"},
                    params={"criteria": f"(Phone:equals:{query})"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return [
                        Lead(
                            id=record["id"],
                            first_name=record.get("First_Name"),
                            last_name=record.get("Last_Name"),
                            phone=record.get("Phone", "")
                        )
                        for record in data.get("data", [])
                    ]
        except Exception:
            pass
        return []
    
    async def add_note(self, lead_id: str, note: str) -> CRMSyncResult:
        """Add note to lead in Zoho CRM"""
        try:
            token = await self._get_access_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/Leads/{lead_id}/Notes",
                    headers={
                        "Authorization": f"Zoho-oauthtoken {token}",
                        "Content-Type": "application/json"
                    },
                    json={"data": [{"Note_Content": note}]}
                )
                
                if response.status_code in [200, 201]:
                    return CRMSyncResult(
                        success=True,
                        crm_type="zoho",
                        crm_record_id=lead_id,
                        operation="add_note",
                        message="Note added successfully"
                    )
        except Exception as e:
            return CRMSyncResult(
                success=False,
                crm_type="zoho",
                operation="add_note",
                message=str(e)
            )


class HubSpotIntegration(CRMIntegration):
    """
    HubSpot CRM Integration
    
    Requires:
    - HUBSPOT_ACCESS_TOKEN (private app token)
    """
    
    def __init__(self):
        self.access_token = os.getenv("HUBSPOT_ACCESS_TOKEN")
        self.base_url = "https://api.hubapi.com"
    
    def _lead_to_hubspot(self, lead: Lead) -> Dict:
        """Convert Lead to HubSpot contact format"""
        properties = {
            "firstname": lead.first_name or "",
            "lastname": lead.last_name or "Unknown",
            "email": lead.email,
            "phone": lead.phone,
            "company": lead.company or "",
            "hs_lead_status": "NEW",
            
            # Custom properties (must be created in HubSpot first)
            "voice_analysis_id": lead.voice_analysis_id,
            "customer_emotion": lead.emotion,
            "customer_intent": lead.intent,
            "ai_lead_score": str(lead.lead_score) if lead.lead_score else None,
            "detected_dialect": lead.dialect,
            "voice_transcription": lead.transcription[:1000] if lead.transcription else None
        }
        
        return {k: v for k, v in properties.items() if v is not None}
    
    async def create_lead(self, lead: Lead) -> CRMSyncResult:
        """Create contact in HubSpot"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/crm/v3/objects/contacts",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={"properties": self._lead_to_hubspot(lead)}
                )
                
                if response.status_code == 201:
                    data = response.json()
                    return CRMSyncResult(
                        success=True,
                        crm_type="hubspot",
                        crm_record_id=data["id"],
                        operation="create",
                        message="Contact created successfully",
                        raw_response=data
                    )
                else:
                    return CRMSyncResult(
                        success=False,
                        crm_type="hubspot",
                        operation="create",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return CRMSyncResult(
                success=False,
                crm_type="hubspot",
                operation="create",
                message=str(e)
            )
    
    async def update_lead(self, lead_id: str, lead: Lead) -> CRMSyncResult:
        """Update contact in HubSpot"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.base_url}/crm/v3/objects/contacts/{lead_id}",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={"properties": self._lead_to_hubspot(lead)}
                )
                
                if response.status_code == 200:
                    return CRMSyncResult(
                        success=True,
                        crm_type="hubspot",
                        crm_record_id=lead_id,
                        operation="update",
                        message="Contact updated successfully"
                    )
                else:
                    return CRMSyncResult(
                        success=False,
                        crm_type="hubspot",
                        operation="update",
                        message=f"Failed: {response.text}"
                    )
        except Exception as e:
            return CRMSyncResult(
                success=False,
                crm_type="hubspot",
                operation="update",
                message=str(e)
            )
    
    async def get_lead(self, lead_id: str) -> Optional[Lead]:
        """Get contact from HubSpot"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/crm/v3/objects/contacts/{lead_id}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"properties": "firstname,lastname,email,phone,company"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    props = data["properties"]
                    return Lead(
                        id=data["id"],
                        first_name=props.get("firstname"),
                        last_name=props.get("lastname"),
                        email=props.get("email"),
                        phone=props.get("phone", ""),
                        company=props.get("company")
                    )
        except Exception:
            pass
        return None
    
    async def search_leads(self, query: str) -> List[Lead]:
        """Search contacts in HubSpot"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/crm/v3/objects/contacts/search",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "filterGroups": [{
                            "filters": [{
                                "propertyName": "phone",
                                "operator": "CONTAINS_TOKEN",
                                "value": query
                            }]
                        }],
                        "properties": ["firstname", "lastname", "email", "phone"]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return [
                        Lead(
                            id=record["id"],
                            first_name=record["properties"].get("firstname"),
                            last_name=record["properties"].get("lastname"),
                            phone=record["properties"].get("phone", "")
                        )
                        for record in data.get("results", [])
                    ]
        except Exception:
            pass
        return []
    
    async def add_note(self, lead_id: str, note: str) -> CRMSyncResult:
        """Add note to contact in HubSpot"""
        try:
            async with httpx.AsyncClient() as client:
                # Create engagement (note)
                response = await client.post(
                    f"{self.base_url}/crm/v3/objects/notes",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "properties": {
                            "hs_note_body": note,
                            "hs_timestamp": datetime.utcnow().isoformat()
                        },
                        "associations": [{
                            "to": {"id": lead_id},
                            "types": [{
                                "associationCategory": "HUBSPOT_DEFINED",
                                "associationTypeId": 202
                            }]
                        }]
                    }
                )
                
                if response.status_code == 201:
                    return CRMSyncResult(
                        success=True,
                        crm_type="hubspot",
                        crm_record_id=lead_id,
                        operation="add_note",
                        message="Note added successfully"
                    )
        except Exception as e:
            return CRMSyncResult(
                success=False,
                crm_type="hubspot",
                operation="add_note",
                message=str(e)
            )


class CRMFactory:
    """Factory for creating CRM integrations"""
    
    @staticmethod
    def get_integration(crm_type: str) -> CRMIntegration:
        """Get CRM integration by type"""
        integrations = {
            "zoho": ZohoCRMIntegration,
            "hubspot": HubSpotIntegration
        }
        
        if crm_type not in integrations:
            raise ValueError(f"Unsupported CRM: {crm_type}")
        
        return integrations[crm_type]()


# Voice-to-Lead helper
async def voice_to_lead(
    voice_result: Dict[str, Any],
    phone: str,
    crm_type: str = "zoho"
) -> CRMSyncResult:
    """
    Convert voice analysis result to CRM lead
    
    Args:
        voice_result: Result from voice processing API
        phone: Customer phone number
        crm_type: Target CRM (zoho, hubspot)
    
    Returns:
        CRMSyncResult with sync status
    """
    # Create lead from voice data
    lead = Lead(
        phone=phone,
        voice_analysis_id=voice_result.get("request_id"),
        transcription=voice_result.get("transcription"),
        emotion=voice_result.get("emotion"),
        sentiment=voice_result.get("sentiment"),
        intent=voice_result.get("intent"),
        lead_score=voice_result.get("lead_score"),
        dialect=voice_result.get("dialect")
    )
    
    # Sync to CRM
    crm = CRMFactory.get_integration(crm_type)
    return await crm.create_lead(lead)
