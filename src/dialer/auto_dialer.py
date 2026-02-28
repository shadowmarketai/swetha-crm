"""
VoiceFlow Marketing AI - Auto Dialer
=====================================
Inspired by RSoft's R Dialer - Essential for telecaller CRM

Features:
- Predictive dialing
- Power dialing
- Preview dialing
- Campaign management
- DNC (Do Not Call) list
- Call scheduling
- Real-time analytics
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import secrets
import random


class DialerMode(Enum):
    """Dialer modes"""
    PREVIEW = "preview"         # Agent sees info before call
    POWER = "power"             # Auto-dial when agent available
    PREDICTIVE = "predictive"   # Predict agent availability, dial ahead
    PROGRESSIVE = "progressive" # Dial next when agent finishes


class CallDisposition(Enum):
    """Call outcome dispositions"""
    CONNECTED = "connected"
    NO_ANSWER = "no_answer"
    BUSY = "busy"
    VOICEMAIL = "voicemail"
    WRONG_NUMBER = "wrong_number"
    NOT_INTERESTED = "not_interested"
    CALLBACK = "callback"
    SALE = "sale"
    DNC = "dnc"  # Do Not Call
    FAILED = "failed"


class CampaignStatus(Enum):
    """Campaign status"""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class DialerContact:
    """Contact for dialing"""
    id: str
    phone: str
    name: str
    email: Optional[str] = None
    
    # Custom fields
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    
    # Dialer metadata
    priority: int = 5  # 1-10, higher = more priority
    timezone: str = "Asia/Kolkata"
    best_time_start: str = "09:00"
    best_time_end: str = "21:00"
    
    # Attempt tracking
    attempt_count: int = 0
    max_attempts: int = 3
    last_attempt_at: Optional[datetime] = None
    last_disposition: Optional[CallDisposition] = None
    
    # Status
    is_dnc: bool = False
    is_completed: bool = False
    
    # Callback
    callback_at: Optional[datetime] = None
    callback_note: Optional[str] = None


@dataclass
class DialerCampaign:
    """Dialer campaign"""
    id: str
    tenant_id: str
    name: str
    description: str = ""
    
    # Configuration
    mode: DialerMode = DialerMode.POWER
    caller_id: str = ""
    
    # Timing
    start_time: str = "09:00"
    end_time: str = "21:00"
    days_of_week: List[int] = field(default_factory=lambda: [0, 1, 2, 3, 4, 5])  # Mon-Sat
    
    # Limits
    max_attempts_per_contact: int = 3
    retry_interval_minutes: int = 60
    max_concurrent_calls: int = 5
    calls_per_agent: int = 1
    
    # Script
    script_template: str = ""
    
    # Status
    status: CampaignStatus = CampaignStatus.DRAFT
    
    # Stats
    total_contacts: int = 0
    contacted: int = 0
    connected: int = 0
    converted: int = 0
    
    # Timestamps
    scheduled_start: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DialerAgent:
    """Agent in dialer system"""
    id: str
    tenant_id: str
    name: str
    extension: str
    
    # Status
    is_available: bool = True
    is_on_call: bool = False
    is_in_wrap_up: bool = False
    
    # Current
    current_call_id: Optional[str] = None
    current_campaign_id: Optional[str] = None
    
    # Stats
    calls_today: int = 0
    connected_today: int = 0
    talk_time_today: int = 0  # seconds
    
    # Settings
    wrap_up_time_seconds: int = 30
    auto_answer: bool = True


@dataclass
class DialerCall:
    """Active or completed call"""
    id: str
    campaign_id: str
    contact_id: str
    agent_id: Optional[str]
    
    # Call details
    phone: str
    caller_id: str
    
    # Status
    disposition: Optional[CallDisposition] = None
    
    # Timing
    initiated_at: datetime = field(default_factory=datetime.now)
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    
    # Recording
    recording_url: Optional[str] = None
    
    # Notes
    notes: str = ""
    
    # Voice AI analysis (our advantage over RSoft!)
    transcription: Optional[str] = None
    emotion: Optional[str] = None
    intent: Optional[str] = None
    lead_score: Optional[float] = None


class AutoDialerService:
    """
    Auto Dialer Service
    
    Supports multiple dialing modes:
    - Preview: Agent sees contact info, decides to dial
    - Power: Auto-dials when agent is available
    - Predictive: Dials ahead based on agent availability prediction
    - Progressive: Dials next contact when agent finishes
    """
    
    def __init__(self, telephony_manager=None, voice_engine=None):
        self.telephony = telephony_manager
        self.voice_engine = voice_engine
        
        # In-memory storage (use DB in production)
        self._campaigns: Dict[str, DialerCampaign] = {}
        self._contacts: Dict[str, List[DialerContact]] = {}  # campaign_id -> contacts
        self._agents: Dict[str, DialerAgent] = {}
        self._calls: Dict[str, DialerCall] = {}
        self._dnc_list: set = set()  # Phone numbers
        
        # Active campaign workers
        self._active_workers: Dict[str, asyncio.Task] = {}
    
    # ==========================================
    # Campaign Management
    # ==========================================
    
    def create_campaign(
        self,
        tenant_id: str,
        name: str,
        mode: DialerMode = DialerMode.POWER,
        caller_id: str = "",
        **kwargs
    ) -> DialerCampaign:
        """Create a new dialer campaign"""
        campaign_id = secrets.token_urlsafe(16)
        
        campaign = DialerCampaign(
            id=campaign_id,
            tenant_id=tenant_id,
            name=name,
            mode=mode,
            caller_id=caller_id,
            description=kwargs.get("description", ""),
            start_time=kwargs.get("start_time", "09:00"),
            end_time=kwargs.get("end_time", "21:00"),
            max_attempts_per_contact=kwargs.get("max_attempts", 3),
            max_concurrent_calls=kwargs.get("max_concurrent", 5),
            script_template=kwargs.get("script", "")
        )
        
        self._campaigns[campaign_id] = campaign
        self._contacts[campaign_id] = []
        
        return campaign
    
    def add_contacts_to_campaign(
        self,
        campaign_id: str,
        contacts: List[Dict[str, Any]]
    ) -> int:
        """Add contacts to campaign"""
        if campaign_id not in self._campaigns:
            raise ValueError("Campaign not found")
        
        added = 0
        for contact_data in contacts:
            phone = contact_data.get("phone", "").strip()
            
            # Skip DNC numbers
            if phone in self._dnc_list:
                continue
            
            contact = DialerContact(
                id=secrets.token_urlsafe(8),
                phone=phone,
                name=contact_data.get("name", ""),
                email=contact_data.get("email"),
                custom_fields=contact_data.get("custom_fields", {}),
                priority=contact_data.get("priority", 5)
            )
            
            self._contacts[campaign_id].append(contact)
            added += 1
        
        # Update campaign stats
        self._campaigns[campaign_id].total_contacts = len(self._contacts[campaign_id])
        
        return added
    
    def import_contacts_from_csv(
        self,
        campaign_id: str,
        csv_content: str,
        phone_column: str = "phone",
        name_column: str = "name"
    ) -> int:
        """Import contacts from CSV"""
        import csv
        from io import StringIO
        
        reader = csv.DictReader(StringIO(csv_content))
        contacts = []
        
        for row in reader:
            contacts.append({
                "phone": row.get(phone_column, ""),
                "name": row.get(name_column, ""),
                "email": row.get("email", ""),
                "custom_fields": {k: v for k, v in row.items() 
                                 if k not in [phone_column, name_column, "email"]}
            })
        
        return self.add_contacts_to_campaign(campaign_id, contacts)
    
    async def start_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Start a dialer campaign"""
        campaign = self._campaigns.get(campaign_id)
        if not campaign:
            raise ValueError("Campaign not found")
        
        if campaign.status == CampaignStatus.RUNNING:
            return {"status": "already_running"}
        
        campaign.status = CampaignStatus.RUNNING
        campaign.started_at = datetime.now()
        
        # Start worker based on mode
        if campaign.mode == DialerMode.PREDICTIVE:
            worker = asyncio.create_task(self._predictive_dialer_worker(campaign_id))
        elif campaign.mode == DialerMode.POWER:
            worker = asyncio.create_task(self._power_dialer_worker(campaign_id))
        else:
            worker = asyncio.create_task(self._progressive_dialer_worker(campaign_id))
        
        self._active_workers[campaign_id] = worker
        
        return {
            "status": "started",
            "campaign_id": campaign_id,
            "mode": campaign.mode.value,
            "total_contacts": campaign.total_contacts
        }
    
    async def pause_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Pause a running campaign"""
        campaign = self._campaigns.get(campaign_id)
        if not campaign:
            raise ValueError("Campaign not found")
        
        campaign.status = CampaignStatus.PAUSED
        
        # Cancel worker
        if campaign_id in self._active_workers:
            self._active_workers[campaign_id].cancel()
            del self._active_workers[campaign_id]
        
        return {"status": "paused"}
    
    async def stop_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Stop a campaign"""
        campaign = self._campaigns.get(campaign_id)
        if not campaign:
            raise ValueError("Campaign not found")
        
        campaign.status = CampaignStatus.COMPLETED
        campaign.completed_at = datetime.now()
        
        # Cancel worker
        if campaign_id in self._active_workers:
            self._active_workers[campaign_id].cancel()
            del self._active_workers[campaign_id]
        
        return {
            "status": "completed",
            "stats": self.get_campaign_stats(campaign_id)
        }
    
    def get_campaign_stats(self, campaign_id: str) -> Dict[str, Any]:
        """Get campaign statistics"""
        campaign = self._campaigns.get(campaign_id)
        if not campaign:
            return {}
        
        contacts = self._contacts.get(campaign_id, [])
        
        # Calculate stats
        completed = sum(1 for c in contacts if c.is_completed)
        connected = sum(1 for c in contacts if c.last_disposition == CallDisposition.CONNECTED)
        no_answer = sum(1 for c in contacts if c.last_disposition == CallDisposition.NO_ANSWER)
        callbacks = sum(1 for c in contacts if c.callback_at is not None)
        
        return {
            "campaign_id": campaign_id,
            "name": campaign.name,
            "status": campaign.status.value,
            "total_contacts": campaign.total_contacts,
            "completed": completed,
            "remaining": campaign.total_contacts - completed,
            "connected": connected,
            "no_answer": no_answer,
            "callbacks_scheduled": callbacks,
            "connection_rate": (connected / completed * 100) if completed > 0 else 0,
            "started_at": campaign.started_at.isoformat() if campaign.started_at else None,
            "runtime_minutes": self._calculate_runtime(campaign)
        }
    
    # ==========================================
    # Agent Management
    # ==========================================
    
    def register_agent(
        self,
        tenant_id: str,
        name: str,
        extension: str
    ) -> DialerAgent:
        """Register an agent for dialing"""
        agent_id = secrets.token_urlsafe(8)
        
        agent = DialerAgent(
            id=agent_id,
            tenant_id=tenant_id,
            name=name,
            extension=extension
        )
        
        self._agents[agent_id] = agent
        return agent
    
    def set_agent_available(self, agent_id: str, available: bool) -> None:
        """Set agent availability"""
        if agent_id in self._agents:
            self._agents[agent_id].is_available = available
    
    def get_available_agents(self, tenant_id: str) -> List[DialerAgent]:
        """Get available agents for tenant"""
        return [
            a for a in self._agents.values()
            if a.tenant_id == tenant_id and a.is_available and not a.is_on_call
        ]
    
    # ==========================================
    # DNC (Do Not Call) Management
    # ==========================================
    
    def add_to_dnc(self, phone: str) -> None:
        """Add phone to DNC list"""
        self._dnc_list.add(phone.strip())
    
    def remove_from_dnc(self, phone: str) -> None:
        """Remove phone from DNC list"""
        self._dnc_list.discard(phone.strip())
    
    def is_dnc(self, phone: str) -> bool:
        """Check if phone is on DNC list"""
        return phone.strip() in self._dnc_list
    
    def import_dnc_list(self, phones: List[str]) -> int:
        """Import phones to DNC list"""
        count = 0
        for phone in phones:
            if phone.strip():
                self._dnc_list.add(phone.strip())
                count += 1
        return count
    
    # ==========================================
    # Call Handling
    # ==========================================
    
    async def initiate_call(
        self,
        campaign_id: str,
        contact: DialerContact,
        agent: Optional[DialerAgent] = None
    ) -> DialerCall:
        """Initiate a call to contact"""
        campaign = self._campaigns.get(campaign_id)
        if not campaign:
            raise ValueError("Campaign not found")
        
        call_id = secrets.token_urlsafe(16)
        
        call = DialerCall(
            id=call_id,
            campaign_id=campaign_id,
            contact_id=contact.id,
            agent_id=agent.id if agent else None,
            phone=contact.phone,
            caller_id=campaign.caller_id
        )
        
        self._calls[call_id] = call
        
        # Update contact
        contact.attempt_count += 1
        contact.last_attempt_at = datetime.now()
        
        # Update agent
        if agent:
            agent.is_on_call = True
            agent.current_call_id = call_id
        
        # Make actual call via telephony
        if self.telephony:
            result = await self.telephony.make_call(
                from_number=campaign.caller_id,
                to_number=contact.phone,
                webhook_url=f"/api/v1/dialer/webhook/{call_id}"
            )
            # Handle result...
        
        return call
    
    def complete_call(
        self,
        call_id: str,
        disposition: CallDisposition,
        notes: str = "",
        callback_at: datetime = None
    ) -> DialerCall:
        """Complete a call with disposition"""
        call = self._calls.get(call_id)
        if not call:
            raise ValueError("Call not found")
        
        call.disposition = disposition
        call.ended_at = datetime.now()
        call.notes = notes
        
        # Update contact
        campaign_contacts = self._contacts.get(call.campaign_id, [])
        for contact in campaign_contacts:
            if contact.id == call.contact_id:
                contact.last_disposition = disposition
                
                if disposition in [CallDisposition.CONNECTED, CallDisposition.SALE, 
                                   CallDisposition.NOT_INTERESTED, CallDisposition.DNC]:
                    contact.is_completed = True
                
                if disposition == CallDisposition.CALLBACK and callback_at:
                    contact.callback_at = callback_at
                
                if disposition == CallDisposition.DNC:
                    self.add_to_dnc(contact.phone)
                
                break
        
        # Update campaign stats
        campaign = self._campaigns.get(call.campaign_id)
        if campaign:
            campaign.contacted += 1
            if disposition == CallDisposition.CONNECTED:
                campaign.connected += 1
            if disposition == CallDisposition.SALE:
                campaign.converted += 1
        
        # Free up agent
        if call.agent_id and call.agent_id in self._agents:
            agent = self._agents[call.agent_id]
            agent.is_on_call = False
            agent.is_in_wrap_up = True
            agent.current_call_id = None
            agent.calls_today += 1
            
            if disposition == CallDisposition.CONNECTED:
                agent.connected_today += 1
            
            # Schedule wrap-up end
            asyncio.create_task(self._end_wrap_up(agent))
        
        return call
    
    async def _end_wrap_up(self, agent: DialerAgent):
        """End agent wrap-up time"""
        await asyncio.sleep(agent.wrap_up_time_seconds)
        agent.is_in_wrap_up = False
    
    # ==========================================
    # Dialer Workers
    # ==========================================
    
    async def _power_dialer_worker(self, campaign_id: str):
        """Power dialer - dial when agent available"""
        campaign = self._campaigns.get(campaign_id)
        
        while campaign and campaign.status == CampaignStatus.RUNNING:
            # Check if within calling hours
            if not self._is_calling_hours(campaign):
                await asyncio.sleep(60)
                continue
            
            # Get available agents
            agents = self.get_available_agents(campaign.tenant_id)
            
            for agent in agents:
                # Get next contact
                contact = self._get_next_contact(campaign_id)
                if not contact:
                    # No more contacts
                    await self.stop_campaign(campaign_id)
                    return
                
                # Initiate call
                await self.initiate_call(campaign_id, contact, agent)
            
            # Wait before next check
            await asyncio.sleep(1)
    
    async def _predictive_dialer_worker(self, campaign_id: str):
        """Predictive dialer - dial ahead based on predictions"""
        campaign = self._campaigns.get(campaign_id)
        
        # Predict answer rate and agent availability
        predicted_answer_rate = 0.3  # 30% answer rate
        
        while campaign and campaign.status == CampaignStatus.RUNNING:
            if not self._is_calling_hours(campaign):
                await asyncio.sleep(60)
                continue
            
            # Calculate how many calls to make
            available_agents = len(self.get_available_agents(campaign.tenant_id))
            calls_to_make = int(available_agents / predicted_answer_rate)
            calls_to_make = min(calls_to_make, campaign.max_concurrent_calls)
            
            # Get active calls count
            active_calls = sum(1 for c in self._calls.values() 
                             if c.campaign_id == campaign_id and c.ended_at is None)
            
            calls_to_make = max(0, calls_to_make - active_calls)
            
            for _ in range(calls_to_make):
                contact = self._get_next_contact(campaign_id)
                if not contact:
                    await self.stop_campaign(campaign_id)
                    return
                
                # Initiate without agent (will be assigned when answered)
                await self.initiate_call(campaign_id, contact)
            
            await asyncio.sleep(2)
    
    async def _progressive_dialer_worker(self, campaign_id: str):
        """Progressive dialer - one call at a time per agent"""
        # Similar to power dialer but more conservative
        await self._power_dialer_worker(campaign_id)
    
    def _get_next_contact(self, campaign_id: str) -> Optional[DialerContact]:
        """Get next contact to dial"""
        contacts = self._contacts.get(campaign_id, [])
        campaign = self._campaigns.get(campaign_id)
        
        now = datetime.now()
        
        # First, check for callbacks
        for contact in contacts:
            if (contact.callback_at and 
                contact.callback_at <= now and 
                not contact.is_completed):
                contact.callback_at = None  # Clear callback
                return contact
        
        # Then, get next by priority
        available = [
            c for c in contacts
            if not c.is_completed
            and not c.is_dnc
            and c.attempt_count < (campaign.max_attempts_per_contact if campaign else 3)
            and (c.last_attempt_at is None or 
                 now - c.last_attempt_at > timedelta(minutes=campaign.retry_interval_minutes if campaign else 60))
        ]
        
        if not available:
            return None
        
        # Sort by priority (higher first)
        available.sort(key=lambda c: c.priority, reverse=True)
        
        return available[0]
    
    def _is_calling_hours(self, campaign: DialerCampaign) -> bool:
        """Check if current time is within calling hours"""
        now = datetime.now()
        
        # Check day of week
        if now.weekday() not in campaign.days_of_week:
            return False
        
        # Check time
        current_time = now.strftime("%H:%M")
        return campaign.start_time <= current_time <= campaign.end_time
    
    def _calculate_runtime(self, campaign: DialerCampaign) -> float:
        """Calculate campaign runtime in minutes"""
        if not campaign.started_at:
            return 0
        
        end_time = campaign.completed_at or datetime.now()
        delta = end_time - campaign.started_at
        return delta.total_seconds() / 60


# ============================================
# FastAPI Router
# ============================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

dialer_router = APIRouter(prefix="/api/v1/dialer", tags=["Auto Dialer"])

# Initialize service
dialer_service = AutoDialerService()


class CreateCampaignRequest(BaseModel):
    name: str
    mode: str = "power"
    caller_id: str
    description: str = ""
    start_time: str = "09:00"
    end_time: str = "21:00"
    max_attempts: int = 3
    script: str = ""


class AddContactsRequest(BaseModel):
    contacts: List[Dict[str, Any]]


class CompleteCallRequest(BaseModel):
    disposition: str
    notes: str = ""
    callback_at: Optional[str] = None


@dialer_router.post("/campaigns")
async def create_campaign(
    request: CreateCampaignRequest,
    tenant_id: str = "demo_tenant"
):
    """Create dialer campaign"""
    campaign = dialer_service.create_campaign(
        tenant_id=tenant_id,
        name=request.name,
        mode=DialerMode(request.mode),
        caller_id=request.caller_id,
        description=request.description,
        start_time=request.start_time,
        end_time=request.end_time,
        max_attempts=request.max_attempts,
        script=request.script
    )
    
    return {
        "campaign_id": campaign.id,
        "name": campaign.name,
        "status": campaign.status.value
    }


@dialer_router.post("/campaigns/{campaign_id}/contacts")
async def add_contacts(campaign_id: str, request: AddContactsRequest):
    """Add contacts to campaign"""
    try:
        count = dialer_service.add_contacts_to_campaign(
            campaign_id=campaign_id,
            contacts=request.contacts
        )
        return {"added": count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@dialer_router.post("/campaigns/{campaign_id}/start")
async def start_campaign(campaign_id: str):
    """Start dialer campaign"""
    try:
        result = await dialer_service.start_campaign(campaign_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@dialer_router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str):
    """Pause dialer campaign"""
    try:
        result = await dialer_service.pause_campaign(campaign_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@dialer_router.post("/campaigns/{campaign_id}/stop")
async def stop_campaign(campaign_id: str):
    """Stop dialer campaign"""
    try:
        result = await dialer_service.stop_campaign(campaign_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@dialer_router.get("/campaigns/{campaign_id}/stats")
async def get_stats(campaign_id: str):
    """Get campaign statistics"""
    stats = dialer_service.get_campaign_stats(campaign_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return stats


@dialer_router.post("/calls/{call_id}/complete")
async def complete_call(call_id: str, request: CompleteCallRequest):
    """Complete a call with disposition"""
    try:
        callback_dt = None
        if request.callback_at:
            callback_dt = datetime.fromisoformat(request.callback_at)
        
        call = dialer_service.complete_call(
            call_id=call_id,
            disposition=CallDisposition(request.disposition),
            notes=request.notes,
            callback_at=callback_dt
        )
        
        return {"status": "completed", "disposition": call.disposition.value}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@dialer_router.post("/dnc")
async def add_to_dnc(phone: str):
    """Add phone to DNC list"""
    dialer_service.add_to_dnc(phone)
    return {"status": "added", "phone": phone}


@dialer_router.get("/dnc/check")
async def check_dnc(phone: str):
    """Check if phone is on DNC list"""
    return {"phone": phone, "is_dnc": dialer_service.is_dnc(phone)}
