"""
VoiceFlow Marketing AI - Help Desk & Ticketing System
======================================================
Customer support ticket management with voice AI integration
Inspired by RSoft's Ticket Management System

Features:
- Multi-channel ticket creation (Voice, WhatsApp, Email, Web)
- Auto-ticket creation from voice calls
- SLA management
- Agent assignment
- Escalation rules
- Voice transcription in tickets
- Emotion-based priority
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from enum import Enum
import secrets


class TicketStatus(Enum):
    """Ticket status"""
    NEW = "new"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_CUSTOMER = "waiting_customer"
    WAITING_INTERNAL = "waiting_internal"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REOPENED = "reopened"


class TicketPriority(Enum):
    """Ticket priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"
    CRITICAL = "critical"


class TicketChannel(Enum):
    """Ticket creation channel"""
    VOICE_CALL = "voice_call"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    WEB_FORM = "web_form"
    CHAT = "chat"
    SMS = "sms"
    API = "api"


class TicketCategory(Enum):
    """Ticket categories"""
    GENERAL_INQUIRY = "general_inquiry"
    TECHNICAL_SUPPORT = "technical_support"
    BILLING = "billing"
    COMPLAINT = "complaint"
    FEEDBACK = "feedback"
    FEATURE_REQUEST = "feature_request"
    BUG_REPORT = "bug_report"
    ACCOUNT_ISSUE = "account_issue"
    REFUND = "refund"
    OTHER = "other"


@dataclass
class TicketComment:
    """Comment on a ticket"""
    id: str
    ticket_id: str
    author_id: str
    author_name: str
    author_type: str  # "agent", "customer", "system"
    
    content: str
    is_internal: bool = False  # Internal notes not visible to customer
    
    # Attachments
    attachments: List[Dict[str, str]] = field(default_factory=list)
    
    # Voice-specific (our unique feature!)
    voice_recording_url: Optional[str] = None
    voice_transcription: Optional[str] = None
    
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class SLAPolicy:
    """SLA policy for tickets"""
    id: str
    name: str
    
    # Response times by priority (in minutes)
    first_response_times: Dict[str, int] = field(default_factory=lambda: {
        "low": 480,      # 8 hours
        "medium": 240,   # 4 hours
        "high": 60,      # 1 hour
        "urgent": 30,    # 30 minutes
        "critical": 15   # 15 minutes
    })
    
    # Resolution times by priority (in minutes)
    resolution_times: Dict[str, int] = field(default_factory=lambda: {
        "low": 2880,     # 48 hours
        "medium": 1440,  # 24 hours
        "high": 480,     # 8 hours
        "urgent": 240,   # 4 hours
        "critical": 60   # 1 hour
    })
    
    # Business hours
    business_hours_only: bool = True
    business_start: str = "09:00"
    business_end: str = "18:00"
    business_days: List[int] = field(default_factory=lambda: [0, 1, 2, 3, 4])  # Mon-Fri


@dataclass
class Ticket:
    """Support ticket"""
    id: str
    tenant_id: str
    
    # Ticket details
    subject: str
    description: str
    category: TicketCategory = TicketCategory.GENERAL_INQUIRY
    
    # Status and priority
    status: TicketStatus = TicketStatus.NEW
    priority: TicketPriority = TicketPriority.MEDIUM
    
    # Channel
    channel: TicketChannel = TicketChannel.WEB_FORM
    
    # Customer
    customer_name: str = ""
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    
    # Assignment
    assigned_agent_id: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    assigned_team: Optional[str] = None
    
    # Voice-specific (our unique feature!)
    voice_call_id: Optional[str] = None
    voice_transcription: Optional[str] = None
    voice_emotion: Optional[str] = None  # Detected emotion from call
    voice_sentiment: Optional[str] = None
    voice_recording_url: Optional[str] = None
    
    # SLA
    sla_policy_id: Optional[str] = None
    first_response_due: Optional[datetime] = None
    resolution_due: Optional[datetime] = None
    first_response_at: Optional[datetime] = None
    sla_breached: bool = False
    
    # Related
    related_lead_id: Optional[str] = None
    related_ticket_ids: List[str] = field(default_factory=list)
    
    # Tags
    tags: List[str] = field(default_factory=list)
    
    # Custom fields
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    
    # Comments
    comments: List[TicketComment] = field(default_factory=list)
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    first_responded_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    # Satisfaction
    satisfaction_rating: Optional[int] = None  # 1-5
    satisfaction_feedback: Optional[str] = None


@dataclass
class SupportAgent:
    """Support agent"""
    id: str
    tenant_id: str
    name: str
    email: str
    
    # Skills
    categories: List[TicketCategory] = field(default_factory=list)
    languages: List[str] = field(default_factory=lambda: ["en", "hi"])
    
    # Status
    is_available: bool = True
    is_online: bool = False
    
    # Capacity
    max_tickets: int = 10
    current_tickets: int = 0
    
    # Stats
    tickets_resolved_today: int = 0
    avg_resolution_time: float = 0
    satisfaction_score: float = 0


class HelpDeskService:
    """
    Help Desk Service
    
    Features:
    - Multi-channel ticket management
    - Auto-ticket from voice calls (unique!)
    - SLA tracking
    - Agent assignment
    - Escalations
    """
    
    def __init__(self, voice_engine=None, notification_service=None):
        self.voice_engine = voice_engine
        self.notifications = notification_service
        
        # In-memory storage
        self._tickets: Dict[str, Ticket] = {}
        self._agents: Dict[str, SupportAgent] = {}
        self._sla_policies: Dict[str, SLAPolicy] = {}
        
        # Default SLA
        self._default_sla = SLAPolicy(id="default", name="Standard SLA")
        self._sla_policies["default"] = self._default_sla
        
        # Escalation rules
        self._escalation_rules: List[Dict[str, Any]] = []
        
        # Auto-assignment callback
        self._auto_assign_callback: Optional[Callable] = None
    
    # ==========================================
    # Ticket Management
    # ==========================================
    
    def create_ticket(
        self,
        tenant_id: str,
        subject: str,
        description: str,
        customer_name: str,
        channel: TicketChannel = TicketChannel.WEB_FORM,
        **kwargs
    ) -> Ticket:
        """Create a new ticket"""
        ticket_id = f"TKT-{secrets.token_hex(4).upper()}"
        
        # Determine priority based on emotion if from voice (our unique feature!)
        priority = TicketPriority(kwargs.get("priority", "medium"))
        voice_emotion = kwargs.get("voice_emotion")
        
        if voice_emotion:
            # Auto-escalate based on emotion
            if voice_emotion in ["angry", "frustrated", "upset"]:
                priority = TicketPriority.HIGH
            elif voice_emotion in ["very_angry", "furious"]:
                priority = TicketPriority.URGENT
        
        ticket = Ticket(
            id=ticket_id,
            tenant_id=tenant_id,
            subject=subject,
            description=description,
            customer_name=customer_name,
            customer_email=kwargs.get("customer_email"),
            customer_phone=kwargs.get("customer_phone"),
            channel=channel,
            category=TicketCategory(kwargs.get("category", "general_inquiry")),
            priority=priority,
            voice_call_id=kwargs.get("voice_call_id"),
            voice_transcription=kwargs.get("voice_transcription"),
            voice_emotion=voice_emotion,
            voice_sentiment=kwargs.get("voice_sentiment"),
            voice_recording_url=kwargs.get("voice_recording_url"),
            tags=kwargs.get("tags", []),
            sla_policy_id="default"
        )
        
        # Calculate SLA deadlines
        self._calculate_sla_deadlines(ticket)
        
        self._tickets[ticket_id] = ticket
        
        # Auto-assign if enabled
        if self._auto_assign_callback:
            agent = self._auto_assign_callback(ticket)
            if agent:
                self.assign_ticket(ticket_id, agent.id)
        
        return ticket
    
    def create_ticket_from_voice_call(
        self,
        tenant_id: str,
        call_id: str,
        customer_phone: str,
        transcription: str,
        emotion: str = None,
        sentiment: str = None,
        recording_url: str = None
    ) -> Ticket:
        """
        Create ticket automatically from voice call
        This is our unique differentiator!
        """
        # Generate subject from transcription
        subject = self._generate_subject_from_transcription(transcription)
        
        return self.create_ticket(
            tenant_id=tenant_id,
            subject=subject,
            description=transcription,
            customer_name=f"Caller: {customer_phone}",
            customer_phone=customer_phone,
            channel=TicketChannel.VOICE_CALL,
            voice_call_id=call_id,
            voice_transcription=transcription,
            voice_emotion=emotion,
            voice_sentiment=sentiment,
            voice_recording_url=recording_url
        )
    
    def _generate_subject_from_transcription(self, transcription: str) -> str:
        """Generate ticket subject from voice transcription"""
        # Simple extraction - first sentence or first 50 chars
        if not transcription:
            return "Voice Call Inquiry"
        
        # Get first sentence
        first_sentence = transcription.split('.')[0].strip()
        
        if len(first_sentence) > 60:
            return first_sentence[:57] + "..."
        
        return first_sentence or "Voice Call Inquiry"
    
    def get_ticket(self, ticket_id: str) -> Optional[Ticket]:
        """Get ticket by ID"""
        return self._tickets.get(ticket_id)
    
    def list_tickets(
        self,
        tenant_id: str,
        status: TicketStatus = None,
        priority: TicketPriority = None,
        agent_id: str = None,
        limit: int = 50
    ) -> List[Ticket]:
        """List tickets with filters"""
        tickets = [t for t in self._tickets.values() if t.tenant_id == tenant_id]
        
        if status:
            tickets = [t for t in tickets if t.status == status]
        
        if priority:
            tickets = [t for t in tickets if t.priority == priority]
        
        if agent_id:
            tickets = [t for t in tickets if t.assigned_agent_id == agent_id]
        
        # Sort by priority and created date
        priority_order = {"critical": 0, "urgent": 1, "high": 2, "medium": 3, "low": 4}
        tickets.sort(key=lambda t: (priority_order.get(t.priority.value, 5), t.created_at))
        
        return tickets[:limit]
    
    def update_ticket(
        self,
        ticket_id: str,
        **updates
    ) -> Ticket:
        """Update ticket"""
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        
        for key, value in updates.items():
            if hasattr(ticket, key):
                if key == "status":
                    value = TicketStatus(value)
                elif key == "priority":
                    value = TicketPriority(value)
                elif key == "category":
                    value = TicketCategory(value)
                
                setattr(ticket, key, value)
        
        ticket.updated_at = datetime.now()
        
        # Track status changes
        if "status" in updates:
            new_status = TicketStatus(updates["status"])
            
            if new_status == TicketStatus.RESOLVED:
                ticket.resolved_at = datetime.now()
            elif new_status == TicketStatus.CLOSED:
                ticket.closed_at = datetime.now()
        
        return ticket
    
    def assign_ticket(self, ticket_id: str, agent_id: str) -> Ticket:
        """Assign ticket to agent"""
        ticket = self._tickets.get(ticket_id)
        agent = self._agents.get(agent_id)
        
        if not ticket:
            raise ValueError("Ticket not found")
        if not agent:
            raise ValueError("Agent not found")
        
        # Update previous agent's count
        if ticket.assigned_agent_id and ticket.assigned_agent_id in self._agents:
            self._agents[ticket.assigned_agent_id].current_tickets -= 1
        
        ticket.assigned_agent_id = agent_id
        ticket.assigned_agent_name = agent.name
        ticket.status = TicketStatus.OPEN
        ticket.updated_at = datetime.now()
        
        agent.current_tickets += 1
        
        return ticket
    
    def add_comment(
        self,
        ticket_id: str,
        author_id: str,
        author_name: str,
        content: str,
        author_type: str = "agent",
        is_internal: bool = False,
        voice_recording_url: str = None,
        voice_transcription: str = None
    ) -> TicketComment:
        """Add comment to ticket"""
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        
        comment = TicketComment(
            id=secrets.token_urlsafe(8),
            ticket_id=ticket_id,
            author_id=author_id,
            author_name=author_name,
            author_type=author_type,
            content=content,
            is_internal=is_internal,
            voice_recording_url=voice_recording_url,
            voice_transcription=voice_transcription
        )
        
        ticket.comments.append(comment)
        ticket.updated_at = datetime.now()
        
        # Track first response
        if author_type == "agent" and not ticket.first_responded_at:
            ticket.first_responded_at = datetime.now()
            ticket.first_response_at = datetime.now()
        
        return comment
    
    def resolve_ticket(
        self,
        ticket_id: str,
        resolution_note: str,
        agent_id: str,
        agent_name: str
    ) -> Ticket:
        """Resolve a ticket"""
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        
        # Add resolution comment
        self.add_comment(
            ticket_id=ticket_id,
            author_id=agent_id,
            author_name=agent_name,
            content=f"Resolved: {resolution_note}",
            author_type="agent"
        )
        
        ticket.status = TicketStatus.RESOLVED
        ticket.resolved_at = datetime.now()
        ticket.updated_at = datetime.now()
        
        # Update agent stats
        if agent_id in self._agents:
            self._agents[agent_id].tickets_resolved_today += 1
            self._agents[agent_id].current_tickets -= 1
        
        return ticket
    
    # ==========================================
    # SLA Management
    # ==========================================
    
    def _calculate_sla_deadlines(self, ticket: Ticket):
        """Calculate SLA deadlines for ticket"""
        sla = self._sla_policies.get(ticket.sla_policy_id, self._default_sla)
        
        priority_key = ticket.priority.value
        
        # First response deadline
        response_minutes = sla.first_response_times.get(priority_key, 240)
        ticket.first_response_due = datetime.now() + timedelta(minutes=response_minutes)
        
        # Resolution deadline
        resolution_minutes = sla.resolution_times.get(priority_key, 1440)
        ticket.resolution_due = datetime.now() + timedelta(minutes=resolution_minutes)
    
    def check_sla_breaches(self, tenant_id: str) -> List[Ticket]:
        """Check for SLA breaches"""
        now = datetime.now()
        breached_tickets = []
        
        for ticket in self._tickets.values():
            if ticket.tenant_id != tenant_id:
                continue
            
            if ticket.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
                continue
            
            # Check first response SLA
            if (ticket.first_response_due and 
                not ticket.first_responded_at and 
                now > ticket.first_response_due):
                ticket.sla_breached = True
                breached_tickets.append(ticket)
            
            # Check resolution SLA
            elif ticket.resolution_due and now > ticket.resolution_due:
                ticket.sla_breached = True
                breached_tickets.append(ticket)
        
        return breached_tickets
    
    # ==========================================
    # Agent Management
    # ==========================================
    
    def register_agent(
        self,
        tenant_id: str,
        name: str,
        email: str,
        categories: List[TicketCategory] = None
    ) -> SupportAgent:
        """Register support agent"""
        agent_id = secrets.token_urlsafe(8)
        
        agent = SupportAgent(
            id=agent_id,
            tenant_id=tenant_id,
            name=name,
            email=email,
            categories=categories or list(TicketCategory)
        )
        
        self._agents[agent_id] = agent
        return agent
    
    def get_available_agents(self, tenant_id: str, category: TicketCategory = None) -> List[SupportAgent]:
        """Get available agents"""
        agents = [
            a for a in self._agents.values()
            if a.tenant_id == tenant_id and a.is_available and a.current_tickets < a.max_tickets
        ]
        
        if category:
            agents = [a for a in agents if category in a.categories]
        
        # Sort by current workload
        agents.sort(key=lambda a: a.current_tickets)
        
        return agents
    
    def auto_assign_to_best_agent(self, ticket: Ticket) -> Optional[SupportAgent]:
        """Auto-assign ticket to best available agent"""
        agents = self.get_available_agents(ticket.tenant_id, ticket.category)
        
        if not agents:
            return None
        
        # Simple round-robin: assign to agent with least tickets
        best_agent = agents[0]
        self.assign_ticket(ticket.id, best_agent.id)
        
        return best_agent
    
    def set_auto_assignment(self, callback: Callable[[Ticket], Optional[SupportAgent]]):
        """Set auto-assignment callback"""
        self._auto_assign_callback = callback
    
    # ==========================================
    # Analytics
    # ==========================================
    
    def get_dashboard_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get help desk dashboard statistics"""
        tickets = [t for t in self._tickets.values() if t.tenant_id == tenant_id]
        
        now = datetime.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Status breakdown
        status_counts = {}
        for status in TicketStatus:
            status_counts[status.value] = sum(1 for t in tickets if t.status == status)
        
        # Priority breakdown
        priority_counts = {}
        for priority in TicketPriority:
            priority_counts[priority.value] = sum(1 for t in tickets if t.priority == priority)
        
        # Channel breakdown
        channel_counts = {}
        for channel in TicketChannel:
            channel_counts[channel.value] = sum(1 for t in tickets if t.channel == channel)
        
        # Today's stats
        today_tickets = [t for t in tickets if t.created_at >= today]
        resolved_today = [t for t in tickets if t.resolved_at and t.resolved_at >= today]
        
        # SLA stats
        open_tickets = [t for t in tickets if t.status not in [TicketStatus.RESOLVED, TicketStatus.CLOSED]]
        sla_breached = sum(1 for t in open_tickets if t.sla_breached)
        
        # Average resolution time
        resolved = [t for t in tickets if t.resolved_at and t.created_at]
        avg_resolution = 0
        if resolved:
            total_time = sum((t.resolved_at - t.created_at).total_seconds() for t in resolved)
            avg_resolution = total_time / len(resolved) / 3600  # Hours
        
        # Voice tickets (our unique feature!)
        voice_tickets = [t for t in tickets if t.channel == TicketChannel.VOICE_CALL]
        voice_emotions = {}
        for t in voice_tickets:
            if t.voice_emotion:
                voice_emotions[t.voice_emotion] = voice_emotions.get(t.voice_emotion, 0) + 1
        
        return {
            "total_tickets": len(tickets),
            "open_tickets": len(open_tickets),
            "tickets_today": len(today_tickets),
            "resolved_today": len(resolved_today),
            "sla_breached": sla_breached,
            "avg_resolution_hours": round(avg_resolution, 2),
            "status_breakdown": status_counts,
            "priority_breakdown": priority_counts,
            "channel_breakdown": channel_counts,
            "voice_tickets": len(voice_tickets),
            "voice_emotions": voice_emotions
        }


# ============================================
# FastAPI Router
# ============================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

helpdesk_router = APIRouter(prefix="/api/v1/helpdesk", tags=["Help Desk"])

# Initialize service
helpdesk_service = HelpDeskService()


class CreateTicketRequest(BaseModel):
    subject: str
    description: str
    customer_name: str
    customer_email: str = None
    customer_phone: str = None
    category: str = "general_inquiry"
    priority: str = "medium"
    channel: str = "web_form"


class AddCommentRequest(BaseModel):
    content: str
    author_id: str
    author_name: str
    is_internal: bool = False


class ResolveTicketRequest(BaseModel):
    resolution_note: str
    agent_id: str
    agent_name: str


@helpdesk_router.post("/tickets")
async def create_ticket(
    request: CreateTicketRequest,
    tenant_id: str = "demo_tenant"
):
    """Create support ticket"""
    ticket = helpdesk_service.create_ticket(
        tenant_id=tenant_id,
        subject=request.subject,
        description=request.description,
        customer_name=request.customer_name,
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        category=request.category,
        priority=request.priority,
        channel=TicketChannel(request.channel)
    )
    
    return {
        "ticket_id": ticket.id,
        "status": ticket.status.value,
        "priority": ticket.priority.value
    }


@helpdesk_router.post("/tickets/from-voice")
async def create_from_voice(
    call_id: str,
    customer_phone: str,
    transcription: str,
    emotion: str = None,
    sentiment: str = None,
    tenant_id: str = "demo_tenant"
):
    """Create ticket from voice call (unique feature!)"""
    ticket = helpdesk_service.create_ticket_from_voice_call(
        tenant_id=tenant_id,
        call_id=call_id,
        customer_phone=customer_phone,
        transcription=transcription,
        emotion=emotion,
        sentiment=sentiment
    )
    
    return {
        "ticket_id": ticket.id,
        "subject": ticket.subject,
        "priority": ticket.priority.value,
        "emotion_detected": emotion
    }


@helpdesk_router.get("/tickets")
async def list_tickets(
    tenant_id: str = "demo_tenant",
    status: str = None,
    priority: str = None,
    agent_id: str = None
):
    """List tickets"""
    tickets = helpdesk_service.list_tickets(
        tenant_id=tenant_id,
        status=TicketStatus(status) if status else None,
        priority=TicketPriority(priority) if priority else None,
        agent_id=agent_id
    )
    
    return {
        "tickets": [
            {
                "id": t.id,
                "subject": t.subject,
                "status": t.status.value,
                "priority": t.priority.value,
                "channel": t.channel.value,
                "customer_name": t.customer_name,
                "assigned_to": t.assigned_agent_name,
                "created_at": t.created_at.isoformat(),
                "voice_emotion": t.voice_emotion
            }
            for t in tickets
        ]
    }


@helpdesk_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Get ticket details"""
    ticket = helpdesk_service.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status.value,
        "priority": ticket.priority.value,
        "category": ticket.category.value,
        "channel": ticket.channel.value,
        "customer": {
            "name": ticket.customer_name,
            "email": ticket.customer_email,
            "phone": ticket.customer_phone
        },
        "assigned_to": ticket.assigned_agent_name,
        "voice_data": {
            "transcription": ticket.voice_transcription,
            "emotion": ticket.voice_emotion,
            "sentiment": ticket.voice_sentiment,
            "recording_url": ticket.voice_recording_url
        } if ticket.voice_call_id else None,
        "sla": {
            "first_response_due": ticket.first_response_due.isoformat() if ticket.first_response_due else None,
            "resolution_due": ticket.resolution_due.isoformat() if ticket.resolution_due else None,
            "breached": ticket.sla_breached
        },
        "comments": [
            {
                "id": c.id,
                "author": c.author_name,
                "content": c.content,
                "is_internal": c.is_internal,
                "created_at": c.created_at.isoformat()
            }
            for c in ticket.comments
        ],
        "created_at": ticket.created_at.isoformat()
    }


@helpdesk_router.post("/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, agent_id: str):
    """Assign ticket to agent"""
    try:
        ticket = helpdesk_service.assign_ticket(ticket_id, agent_id)
        return {"status": "assigned", "agent": ticket.assigned_agent_name}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@helpdesk_router.post("/tickets/{ticket_id}/comments")
async def add_comment(ticket_id: str, request: AddCommentRequest):
    """Add comment to ticket"""
    try:
        comment = helpdesk_service.add_comment(
            ticket_id=ticket_id,
            author_id=request.author_id,
            author_name=request.author_name,
            content=request.content,
            is_internal=request.is_internal
        )
        return {"comment_id": comment.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@helpdesk_router.post("/tickets/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, request: ResolveTicketRequest):
    """Resolve ticket"""
    try:
        ticket = helpdesk_service.resolve_ticket(
            ticket_id=ticket_id,
            resolution_note=request.resolution_note,
            agent_id=request.agent_id,
            agent_name=request.agent_name
        )
        return {"status": "resolved", "resolved_at": ticket.resolved_at.isoformat()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@helpdesk_router.get("/dashboard")
async def get_dashboard(tenant_id: str = "demo_tenant"):
    """Get help desk dashboard stats"""
    return helpdesk_service.get_dashboard_stats(tenant_id)


@helpdesk_router.get("/sla/breaches")
async def get_sla_breaches(tenant_id: str = "demo_tenant"):
    """Get tickets with SLA breaches"""
    breached = helpdesk_service.check_sla_breaches(tenant_id)
    return {
        "breached_count": len(breached),
        "tickets": [
            {
                "id": t.id,
                "subject": t.subject,
                "priority": t.priority.value,
                "first_response_due": t.first_response_due.isoformat() if t.first_response_due else None,
                "resolution_due": t.resolution_due.isoformat() if t.resolution_due else None
            }
            for t in breached
        ]
    }

''
# tickets_router at /api/v1/tickets
''
from fastapi import Query
from typing import Optional

tickets_router = APIRouter(prefix='/api/v1/tickets', tags=['Tickets'])
from fastapi import Query
from typing import Optional

tickets_router = APIRouter(prefix='/api/v1/tickets', tags=['Tickets'])

@tickets_router.get("")
async def list_tickets_api(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    tenant_id: str = "demo_tenant",
):
    tickets = helpdesk_service.list_tickets(
        tenant_id=tenant_id,
        status=TicketStatus(status) if status else None,
        priority=TicketPriority(priority) if priority else None,
    )
    if search:
        sl = search.lower()
        tickets = [t for t in tickets if sl in t.subject.lower() or sl in t.customer_name.lower()]
    page = tickets[offset: offset + limit]
    rows = [{
        "id": t.id, "subject": t.subject,
        "status": t.status.value, "priority": t.priority.value,
        "channel": t.channel.value, "customer_name": t.customer_name,
        "customer_email": t.customer_email,
        "assigned_to": t.assigned_agent_name,
        "voice_emotion": t.voice_emotion,
        "sla_breached": t.sla_breached,
        "created_at": t.created_at.isoformat(),
    } for t in page]
    return {"total": len(tickets), "limit": limit, "offset": offset, "tickets": rows}

@tickets_router.get("/stats")
async def get_ticket_stats(tenant_id: str = "demo_tenant"):
    return helpdesk_service.get_dashboard_stats(tenant_id)

@tickets_router.get("/{ticket_id}")
async def get_ticket_api(ticket_id: str):
    ticket = helpdesk_service.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "id": ticket.id, "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status.value, "priority": ticket.priority.value,
        "category": ticket.category.value, "channel": ticket.channel.value,
        "customer": {"name": ticket.customer_name, "email": ticket.customer_email, "phone": ticket.customer_phone},
        "assigned_to": ticket.assigned_agent_name,
        "sla_breached": ticket.sla_breached,
        "comments": [{
            "id": c.id, "author": c.author_name,
            "content": c.content, "is_internal": c.is_internal,
            "created_at": c.created_at.isoformat()}
            for c in ticket.comments],
        "created_at": ticket.created_at.isoformat(),
    }

@tickets_router.post("", status_code=201)
async def create_ticket_api(request: CreateTicketRequest, tenant_id: str = "demo_tenant"):
    ticket = helpdesk_service.create_ticket(
        tenant_id=tenant_id, subject=request.subject,
        description=request.description, customer_name=request.customer_name,
        customer_email=request.customer_email, customer_phone=request.customer_phone,
        category=request.category, priority=request.priority,
        channel=TicketChannel(request.channel),
    )
    return {"ticket_id": ticket.id, "status": ticket.status.value}

@tickets_router.put("/{ticket_id}")
async def update_ticket_api(ticket_id: str, payload: dict):
    try:
        ticket = helpdesk_service.update_ticket(ticket_id, **payload)
        return {"ticket_id": ticket.id, "status": ticket.status.value}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@tickets_router.patch("/{ticket_id}/status")
async def patch_ticket_status(ticket_id: str, payload: dict):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status required")
    try:
        ticket = helpdesk_service.update_ticket(ticket_id, status=new_status)
        return {"ticket_id": ticket.id, "status": ticket.status.value}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@tickets_router.post("/{ticket_id}/assign")
async def assign_ticket_api(ticket_id: str, payload: dict):
    agent_id = payload.get("agent_id", "")
    try:
        ticket = helpdesk_service.assign_ticket(ticket_id, agent_id)
        return {"status": "assigned", "agent": ticket.assigned_agent_name}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@tickets_router.post("/{ticket_id}/comments")
async def add_comment_api(ticket_id: str, payload: dict):
    content = payload.get("comment") or payload.get("content", "")
    author = payload.get("author_name", "Agent")
    author_id = payload.get("author_id", "agent-001")
    is_internal = payload.get("is_internal", False)
    try:
        comment = helpdesk_service.add_comment(
            ticket_id=ticket_id, author_id=author_id, author_name=author,
            content=content, is_internal=is_internal)
        return {"comment_id": comment.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
