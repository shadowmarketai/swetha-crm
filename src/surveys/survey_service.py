"""
VoiceFlow Marketing AI - Survey Forms (R Forms equivalent)
==========================================================
AI-powered survey and feedback collection system
Inspired by RSoft's R Forms feature

Features:
- Multiple question types
- Voice-enabled surveys
- NPS, CSAT, CES scoring
- Conditional logic
- Real-time analytics
- WhatsApp/SMS delivery
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import secrets
import json


class QuestionType(Enum):
    """Question types"""
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    RATING = "rating"  # 1-5 stars
    NPS = "nps"  # 0-10 Net Promoter Score
    SCALE = "scale"  # Custom scale
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    DROPDOWN = "dropdown"
    DATE = "date"
    PHONE = "phone"
    EMAIL = "email"
    YES_NO = "yes_no"
    VOICE = "voice"  # Voice response (our unique feature!)


class SurveyType(Enum):
    """Survey types"""
    NPS = "nps"  # Net Promoter Score
    CSAT = "csat"  # Customer Satisfaction
    CES = "ces"  # Customer Effort Score
    FEEDBACK = "feedback"  # General feedback
    POLL = "poll"  # Quick poll
    LEAD_FORM = "lead_form"  # Lead capture
    CUSTOM = "custom"  # Custom survey


class DeliveryChannel(Enum):
    """Survey delivery channels"""
    LINK = "link"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    EMAIL = "email"
    VOICE_CALL = "voice_call"  # Our unique feature!
    EMBED = "embed"


@dataclass
class SurveyQuestion:
    """Survey question"""
    id: str
    question_text: str
    question_type: QuestionType
    
    # Options for choice questions
    options: List[str] = field(default_factory=list)
    
    # Validation
    required: bool = True
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    
    # Display
    placeholder: str = ""
    helper_text: str = ""
    
    # Conditional logic
    show_if_question_id: Optional[str] = None
    show_if_answer: Optional[str] = None
    
    # Voice-specific (our advantage!)
    voice_prompt: Optional[str] = None  # What AI says for this question
    
    # Order
    order: int = 0


@dataclass
class Survey:
    """Survey definition"""
    id: str
    tenant_id: str
    name: str
    description: str = ""
    survey_type: SurveyType = SurveyType.CUSTOM
    
    # Questions
    questions: List[SurveyQuestion] = field(default_factory=list)
    
    # Branding
    logo_url: Optional[str] = None
    primary_color: str = "#6366f1"
    background_color: str = "#ffffff"
    
    # Messages
    welcome_message: str = "Thank you for taking our survey!"
    completion_message: str = "Thank you for your feedback!"
    
    # Voice AI settings (our unique feature!)
    voice_enabled: bool = False
    voice_greeting: str = ""
    voice_thank_you: str = ""
    
    # Settings
    is_active: bool = True
    allow_multiple_responses: bool = False
    show_progress_bar: bool = True
    randomize_questions: bool = False
    
    # Delivery
    delivery_channels: List[DeliveryChannel] = field(default_factory=list)
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    
    # Stats
    total_responses: int = 0
    completion_rate: float = 0.0


@dataclass
class SurveyResponse:
    """Survey response"""
    id: str
    survey_id: str
    
    # Respondent
    respondent_phone: Optional[str] = None
    respondent_email: Optional[str] = None
    respondent_name: Optional[str] = None
    
    # Answers
    answers: Dict[str, Any] = field(default_factory=dict)  # question_id -> answer
    
    # Voice analysis (our unique feature!)
    voice_transcriptions: Dict[str, str] = field(default_factory=dict)
    voice_emotions: Dict[str, str] = field(default_factory=dict)
    voice_sentiment: Optional[str] = None
    
    # Scores
    nps_score: Optional[int] = None
    csat_score: Optional[float] = None
    ces_score: Optional[float] = None
    
    # Metadata
    channel: DeliveryChannel = DeliveryChannel.LINK
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    location: Optional[str] = None
    
    # Status
    is_complete: bool = False
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # Duration
    time_spent_seconds: int = 0


class SurveyService:
    """
    Survey Forms Service
    
    Features:
    - Create and manage surveys
    - Multiple question types
    - Voice-enabled surveys (unique!)
    - Real-time analytics
    - NPS/CSAT/CES scoring
    """
    
    def __init__(self, voice_engine=None, messaging_service=None):
        self.voice_engine = voice_engine
        self.messaging = messaging_service
        
        # In-memory storage (use DB in production)
        self._surveys: Dict[str, Survey] = {}
        self._responses: Dict[str, List[SurveyResponse]] = {}  # survey_id -> responses
    
    # ==========================================
    # Survey Management
    # ==========================================
    
    def create_survey(
        self,
        tenant_id: str,
        name: str,
        survey_type: SurveyType = SurveyType.CUSTOM,
        **kwargs
    ) -> Survey:
        """Create a new survey"""
        survey_id = secrets.token_urlsafe(12)
        
        survey = Survey(
            id=survey_id,
            tenant_id=tenant_id,
            name=name,
            survey_type=survey_type,
            description=kwargs.get("description", ""),
            welcome_message=kwargs.get("welcome_message", "Thank you for taking our survey!"),
            completion_message=kwargs.get("completion_message", "Thank you for your feedback!"),
            voice_enabled=kwargs.get("voice_enabled", False),
            primary_color=kwargs.get("primary_color", "#6366f1")
        )
        
        self._surveys[survey_id] = survey
        self._responses[survey_id] = []
        
        return survey
    
    def create_nps_survey(self, tenant_id: str, name: str) -> Survey:
        """Create a standard NPS survey"""
        survey = self.create_survey(
            tenant_id=tenant_id,
            name=name,
            survey_type=SurveyType.NPS,
            welcome_message="We'd love to hear your feedback!"
        )
        
        # Add NPS question
        nps_question = SurveyQuestion(
            id="nps_score",
            question_text="How likely are you to recommend us to a friend or colleague?",
            question_type=QuestionType.NPS,
            required=True,
            voice_prompt="On a scale of 0 to 10, how likely are you to recommend us to a friend or colleague?",
            order=1
        )
        
        # Add follow-up question
        followup = SurveyQuestion(
            id="nps_reason",
            question_text="What's the primary reason for your score?",
            question_type=QuestionType.TEXTAREA,
            required=False,
            voice_prompt="Could you tell us the main reason for your score?",
            order=2
        )
        
        survey.questions = [nps_question, followup]
        return survey
    
    def create_csat_survey(self, tenant_id: str, name: str) -> Survey:
        """Create a standard CSAT survey"""
        survey = self.create_survey(
            tenant_id=tenant_id,
            name=name,
            survey_type=SurveyType.CSAT
        )
        
        # Add CSAT question
        csat_question = SurveyQuestion(
            id="csat_score",
            question_text="How satisfied are you with our service?",
            question_type=QuestionType.RATING,
            required=True,
            min_value=1,
            max_value=5,
            voice_prompt="On a scale of 1 to 5, where 5 is very satisfied, how would you rate our service?",
            order=1
        )
        
        survey.questions = [csat_question]
        return survey
    
    def add_question(
        self,
        survey_id: str,
        question_text: str,
        question_type: QuestionType,
        **kwargs
    ) -> SurveyQuestion:
        """Add question to survey"""
        survey = self._surveys.get(survey_id)
        if not survey:
            raise ValueError("Survey not found")
        
        question_id = secrets.token_urlsafe(8)
        
        question = SurveyQuestion(
            id=question_id,
            question_text=question_text,
            question_type=question_type,
            options=kwargs.get("options", []),
            required=kwargs.get("required", True),
            placeholder=kwargs.get("placeholder", ""),
            helper_text=kwargs.get("helper_text", ""),
            voice_prompt=kwargs.get("voice_prompt", question_text),
            order=len(survey.questions) + 1
        )
        
        survey.questions.append(question)
        return question
    
    def get_survey(self, survey_id: str) -> Optional[Survey]:
        """Get survey by ID"""
        return self._surveys.get(survey_id)
    
    def list_surveys(self, tenant_id: str) -> List[Survey]:
        """List surveys for tenant"""
        return [s for s in self._surveys.values() if s.tenant_id == tenant_id]
    
    def get_survey_link(self, survey_id: str, base_url: str = "https://survey.voiceflow.io") -> str:
        """Get shareable survey link"""
        return f"{base_url}/s/{survey_id}"
    
    # ==========================================
    # Response Collection
    # ==========================================
    
    def start_response(
        self,
        survey_id: str,
        channel: DeliveryChannel = DeliveryChannel.LINK,
        respondent_phone: str = None,
        respondent_email: str = None
    ) -> SurveyResponse:
        """Start a new survey response"""
        survey = self._surveys.get(survey_id)
        if not survey:
            raise ValueError("Survey not found")
        
        response_id = secrets.token_urlsafe(16)
        
        response = SurveyResponse(
            id=response_id,
            survey_id=survey_id,
            respondent_phone=respondent_phone,
            respondent_email=respondent_email,
            channel=channel
        )
        
        self._responses[survey_id].append(response)
        return response
    
    def submit_answer(
        self,
        survey_id: str,
        response_id: str,
        question_id: str,
        answer: Any,
        voice_transcription: str = None,
        voice_emotion: str = None
    ) -> bool:
        """Submit answer for a question"""
        responses = self._responses.get(survey_id, [])
        response = next((r for r in responses if r.id == response_id), None)
        
        if not response:
            return False
        
        response.answers[question_id] = answer
        
        # Store voice data if provided (our unique feature!)
        if voice_transcription:
            response.voice_transcriptions[question_id] = voice_transcription
        if voice_emotion:
            response.voice_emotions[question_id] = voice_emotion
        
        return True
    
    def complete_response(self, survey_id: str, response_id: str) -> SurveyResponse:
        """Mark response as complete and calculate scores"""
        responses = self._responses.get(survey_id, [])
        response = next((r for r in responses if r.id == response_id), None)
        
        if not response:
            raise ValueError("Response not found")
        
        response.is_complete = True
        response.completed_at = datetime.now()
        response.time_spent_seconds = int(
            (response.completed_at - response.started_at).total_seconds()
        )
        
        # Calculate scores
        survey = self._surveys.get(survey_id)
        if survey:
            if survey.survey_type == SurveyType.NPS:
                nps_answer = response.answers.get("nps_score")
                if nps_answer is not None:
                    response.nps_score = int(nps_answer)
            
            elif survey.survey_type == SurveyType.CSAT:
                csat_answer = response.answers.get("csat_score")
                if csat_answer is not None:
                    response.csat_score = float(csat_answer)
            
            # Update survey stats
            survey.total_responses += 1
        
        # Calculate overall sentiment from voice emotions
        if response.voice_emotions:
            emotions = list(response.voice_emotions.values())
            # Simple sentiment calculation
            positive = sum(1 for e in emotions if e in ["happy", "excited", "satisfied"])
            negative = sum(1 for e in emotions if e in ["angry", "frustrated", "sad"])
            
            if positive > negative:
                response.voice_sentiment = "positive"
            elif negative > positive:
                response.voice_sentiment = "negative"
            else:
                response.voice_sentiment = "neutral"
        
        return response
    
    # ==========================================
    # Voice Survey (Our Unique Feature!)
    # ==========================================
    
    async def conduct_voice_survey(
        self,
        survey_id: str,
        phone_number: str
    ) -> Dict[str, Any]:
        """
        Conduct survey via voice call
        This is our unique differentiator from RSoft!
        """
        survey = self._surveys.get(survey_id)
        if not survey or not survey.voice_enabled:
            raise ValueError("Voice survey not available")
        
        # Start response
        response = self.start_response(
            survey_id=survey_id,
            channel=DeliveryChannel.VOICE_CALL,
            respondent_phone=phone_number
        )
        
        # Generate voice prompts for each question
        voice_script = {
            "greeting": survey.voice_greeting or survey.welcome_message,
            "questions": [
                {
                    "id": q.id,
                    "prompt": q.voice_prompt or q.question_text,
                    "type": q.question_type.value,
                    "options": q.options if q.options else None
                }
                for q in sorted(survey.questions, key=lambda x: x.order)
            ],
            "thank_you": survey.voice_thank_you or survey.completion_message
        }
        
        return {
            "response_id": response.id,
            "phone_number": phone_number,
            "voice_script": voice_script,
            "status": "initiated"
        }
    
    # ==========================================
    # Analytics
    # ==========================================
    
    def get_survey_analytics(self, survey_id: str) -> Dict[str, Any]:
        """Get survey analytics"""
        survey = self._surveys.get(survey_id)
        if not survey:
            return {}
        
        responses = self._responses.get(survey_id, [])
        completed = [r for r in responses if r.is_complete]
        
        analytics = {
            "survey_id": survey_id,
            "survey_name": survey.name,
            "total_responses": len(responses),
            "completed_responses": len(completed),
            "completion_rate": len(completed) / len(responses) * 100 if responses else 0,
            "avg_time_seconds": sum(r.time_spent_seconds for r in completed) / len(completed) if completed else 0
        }
        
        # NPS calculation
        if survey.survey_type == SurveyType.NPS:
            nps_scores = [r.nps_score for r in completed if r.nps_score is not None]
            if nps_scores:
                promoters = sum(1 for s in nps_scores if s >= 9)
                detractors = sum(1 for s in nps_scores if s <= 6)
                total = len(nps_scores)
                
                analytics["nps"] = {
                    "score": ((promoters - detractors) / total) * 100,
                    "promoters": promoters,
                    "passives": total - promoters - detractors,
                    "detractors": detractors,
                    "total_responses": total
                }
        
        # CSAT calculation
        if survey.survey_type == SurveyType.CSAT:
            csat_scores = [r.csat_score for r in completed if r.csat_score is not None]
            if csat_scores:
                analytics["csat"] = {
                    "average": sum(csat_scores) / len(csat_scores),
                    "total_responses": len(csat_scores)
                }
        
        # Voice sentiment analysis (our unique feature!)
        voice_responses = [r for r in completed if r.voice_sentiment]
        if voice_responses:
            analytics["voice_sentiment"] = {
                "positive": sum(1 for r in voice_responses if r.voice_sentiment == "positive"),
                "neutral": sum(1 for r in voice_responses if r.voice_sentiment == "neutral"),
                "negative": sum(1 for r in voice_responses if r.voice_sentiment == "negative")
            }
        
        # Question-level analytics
        question_stats = {}
        for question in survey.questions:
            answers = [r.answers.get(question.id) for r in completed if question.id in r.answers]
            
            if question.question_type in [QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE]:
                # Count responses per option
                option_counts = {}
                for answer in answers:
                    if isinstance(answer, list):
                        for a in answer:
                            option_counts[a] = option_counts.get(a, 0) + 1
                    else:
                        option_counts[answer] = option_counts.get(answer, 0) + 1
                
                question_stats[question.id] = {
                    "question": question.question_text,
                    "response_count": len(answers),
                    "distribution": option_counts
                }
            
            elif question.question_type in [QuestionType.RATING, QuestionType.NPS, QuestionType.NUMBER]:
                numeric_answers = [a for a in answers if isinstance(a, (int, float))]
                if numeric_answers:
                    question_stats[question.id] = {
                        "question": question.question_text,
                        "response_count": len(numeric_answers),
                        "average": sum(numeric_answers) / len(numeric_answers),
                        "min": min(numeric_answers),
                        "max": max(numeric_answers)
                    }
        
        analytics["questions"] = question_stats
        
        return analytics
    
    def export_responses(self, survey_id: str, format: str = "json") -> str:
        """Export survey responses"""
        responses = self._responses.get(survey_id, [])
        
        if format == "json":
            return json.dumps([
                {
                    "id": r.id,
                    "respondent_phone": r.respondent_phone,
                    "respondent_email": r.respondent_email,
                    "answers": r.answers,
                    "nps_score": r.nps_score,
                    "csat_score": r.csat_score,
                    "voice_sentiment": r.voice_sentiment,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "time_spent_seconds": r.time_spent_seconds
                }
                for r in responses if r.is_complete
            ], indent=2)
        
        elif format == "csv":
            if not responses:
                return ""
            
            # Get all question IDs
            survey = self._surveys.get(survey_id)
            headers = ["response_id", "phone", "email", "nps_score", "csat_score", "voice_sentiment", "completed_at"]
            headers.extend([q.id for q in survey.questions])
            
            lines = [",".join(headers)]
            
            for r in responses:
                if r.is_complete:
                    row = [
                        r.id,
                        r.respondent_phone or "",
                        r.respondent_email or "",
                        str(r.nps_score) if r.nps_score else "",
                        str(r.csat_score) if r.csat_score else "",
                        r.voice_sentiment or "",
                        r.completed_at.isoformat() if r.completed_at else ""
                    ]
                    row.extend([str(r.answers.get(q.id, "")) for q in survey.questions])
                    lines.append(",".join(row))
            
            return "\n".join(lines)
        
        return ""


# ============================================
# FastAPI Router
# ============================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

survey_router = APIRouter(prefix="/api/v1/surveys", tags=["Survey Forms"])

# Initialize service
survey_service = SurveyService()


class CreateSurveyRequest(BaseModel):
    name: str
    survey_type: str = "custom"
    description: str = ""
    welcome_message: str = "Thank you for taking our survey!"
    voice_enabled: bool = False


class AddQuestionRequest(BaseModel):
    question_text: str
    question_type: str
    options: List[str] = []
    required: bool = True
    voice_prompt: str = ""


class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer: Any
    voice_transcription: str = None


@survey_router.post("")
async def create_survey(
    request: CreateSurveyRequest,
    tenant_id: str = "demo_tenant"
):
    """Create a new survey"""
    survey = survey_service.create_survey(
        tenant_id=tenant_id,
        name=request.name,
        survey_type=SurveyType(request.survey_type),
        description=request.description,
        welcome_message=request.welcome_message,
        voice_enabled=request.voice_enabled
    )
    
    return {
        "survey_id": survey.id,
        "name": survey.name,
        "link": survey_service.get_survey_link(survey.id)
    }


@survey_router.post("/nps")
async def create_nps_survey(name: str, tenant_id: str = "demo_tenant"):
    """Create a standard NPS survey"""
    survey = survey_service.create_nps_survey(tenant_id, name)
    return {
        "survey_id": survey.id,
        "name": survey.name,
        "link": survey_service.get_survey_link(survey.id)
    }


@survey_router.post("/csat")
async def create_csat_survey(name: str, tenant_id: str = "demo_tenant"):
    """Create a standard CSAT survey"""
    survey = survey_service.create_csat_survey(tenant_id, name)
    return {
        "survey_id": survey.id,
        "name": survey.name,
        "link": survey_service.get_survey_link(survey.id)
    }


@survey_router.post("/{survey_id}/questions")
async def add_question(survey_id: str, request: AddQuestionRequest):
    """Add question to survey"""
    try:
        question = survey_service.add_question(
            survey_id=survey_id,
            question_text=request.question_text,
            question_type=QuestionType(request.question_type),
            options=request.options,
            required=request.required,
            voice_prompt=request.voice_prompt
        )
        return {"question_id": question.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@survey_router.get("/{survey_id}")
async def get_survey(survey_id: str):
    """Get survey details"""
    survey = survey_service.get_survey(survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    return {
        "id": survey.id,
        "name": survey.name,
        "description": survey.description,
        "type": survey.survey_type.value,
        "questions": [
            {
                "id": q.id,
                "text": q.question_text,
                "type": q.question_type.value,
                "options": q.options,
                "required": q.required
            }
            for q in survey.questions
        ],
        "voice_enabled": survey.voice_enabled,
        "link": survey_service.get_survey_link(survey_id)
    }


@survey_router.post("/{survey_id}/responses")
async def start_response(
    survey_id: str,
    phone: str = None,
    email: str = None
):
    """Start a new survey response"""
    try:
        response = survey_service.start_response(
            survey_id=survey_id,
            respondent_phone=phone,
            respondent_email=email
        )
        return {"response_id": response.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@survey_router.post("/{survey_id}/responses/{response_id}/answers")
async def submit_answer(
    survey_id: str,
    response_id: str,
    request: SubmitAnswerRequest
):
    """Submit answer for a question"""
    success = survey_service.submit_answer(
        survey_id=survey_id,
        response_id=response_id,
        question_id=request.question_id,
        answer=request.answer,
        voice_transcription=request.voice_transcription
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Response not found")
    
    return {"status": "submitted"}


@survey_router.post("/{survey_id}/responses/{response_id}/complete")
async def complete_response(survey_id: str, response_id: str):
    """Complete survey response"""
    try:
        response = survey_service.complete_response(survey_id, response_id)
        return {
            "status": "completed",
            "nps_score": response.nps_score,
            "csat_score": response.csat_score,
            "voice_sentiment": response.voice_sentiment
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@survey_router.get("/{survey_id}/analytics")
async def get_analytics(survey_id: str):
    """Get survey analytics"""
    analytics = survey_service.get_survey_analytics(survey_id)
    if not analytics:
        raise HTTPException(status_code=404, detail="Survey not found")
    return analytics


@survey_router.get("/{survey_id}/export")
async def export_responses(survey_id: str, format: str = "json"):
    """Export survey responses"""
    data = survey_service.export_responses(survey_id, format)
    return {"data": data, "format": format}


# ============================================
# Additional routes for frontend compatibility
# ============================================

@survey_router.get("")
async def list_surveys_route(tenant_id: str = "demo_tenant"):
    """List all surveys."""
    surveys = survey_service.list_surveys(tenant_id)
    return {
        "total": len(surveys),
        "surveys": [
            {
                "id": s.id,
                "name": s.name,
                "type": s.survey_type.value,
                "description": s.description,
                "total_responses": s.total_responses,
                "is_active": s.is_active,
                "voice_enabled": s.voice_enabled,
                "created_at": s.created_at.isoformat(),
                "link": survey_service.get_survey_link(s.id),
            }
            for s in surveys
        ],
    }


@survey_router.put("/{survey_id}")
async def update_survey(survey_id: str, payload: dict):
    """Update survey metadata."""
    survey = survey_service.get_survey(survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    for key in ["name", "description", "welcome_message", "completion_message",
                "is_active", "voice_enabled", "primary_color"]:
        if key in payload:
            setattr(survey, key, payload[key])
    return {
        "id": survey.id, "name": survey.name, "type": survey.survey_type.value,
        "is_active": survey.is_active,
    }


@survey_router.delete("/{survey_id}")
async def delete_survey(survey_id: str):
    """Delete a survey."""
    survey = survey_service.get_survey(survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    del survey_service._surveys[survey_id]
    survey_service._responses.pop(survey_id, None)
    return {"message": "Survey deleted"}


@survey_router.get("/{survey_id}/responses")
async def list_responses(survey_id: str, limit: int = 50, offset: int = 0):
    """List responses for a survey."""
    survey = survey_service.get_survey(survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    responses = survey_service._responses.get(survey_id, [])
    completed = [r for r in responses if r.is_complete]
    page = completed[offset: offset + limit]
    return {
        "total": len(completed),
        "limit": limit, "offset": offset,
        "responses": [
            {
                "id": r.id,
                "respondent_phone": r.respondent_phone,
                "respondent_email": r.respondent_email,
                "nps_score": r.nps_score,
                "csat_score": r.csat_score,
                "voice_sentiment": r.voice_sentiment,
                "is_complete": r.is_complete,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in page
        ],
    }


@survey_router.get("/{survey_id}/share")
async def get_share_link(survey_id: str):
    """Get shareable link for survey."""
    survey = survey_service.get_survey(survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    link = survey_service.get_survey_link(survey_id)
    return {"survey_id": survey_id, "link": link, "qr_code": None}
