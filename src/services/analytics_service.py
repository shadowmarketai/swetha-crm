"""
AI Training & Analytics Services
Features: AI Training Interface, Sentiment Trends, Competitor Analysis
"""

import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import logging
import uuid
from collections import defaultdict

logger = logging.getLogger(__name__)


class TrainingDataType(str, Enum):
    CONVERSATION = "conversation"
    FAQ = "faq"
    OBJECTION_HANDLING = "objection_handling"
    PRODUCT_INFO = "product_info"
    PRICING = "pricing"
    COMPETITOR_INFO = "competitor_info"


class TrainingExample:
    """Training Data Example"""
    
    def __init__(
        self,
        input_text: str,
        expected_output: str,
        data_type: TrainingDataType,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict] = None
    ):
        self.id = str(uuid.uuid4())[:8]
        self.input_text = input_text
        self.expected_output = expected_output
        self.data_type = data_type
        self.tags = tags or []
        self.metadata = metadata or {}
        self.created_at = datetime.utcnow()
        self.is_approved = False
        self.quality_score: Optional[float] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "input_text": self.input_text,
            "expected_output": self.expected_output,
            "data_type": self.data_type.value,
            "tags": self.tags,
            "is_approved": self.is_approved,
            "quality_score": self.quality_score,
            "created_at": self.created_at.isoformat()
        }


class AITrainingService:
    """
    AI Training Interface Service
    Manages training data, fine-tuning, and model customization
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        # In production, store in database
        self.training_data: Dict[str, TrainingExample] = {}
        self.training_jobs: Dict[str, Dict] = {}
        self.custom_prompts: Dict[str, str] = {}
        
        # Default system prompts by use case
        self.default_prompts = {
            "sales_bot": """You are a professional sales assistant for {company_name}. 
Your goal is to understand customer needs and guide them to the right product/service.
Be friendly, professional, and helpful. Never be pushy.
Products: {products}
Pricing: {pricing}""",
            
            "support_bot": """You are a helpful customer support agent for {company_name}.
Help customers resolve their issues quickly and professionally.
If you can't resolve an issue, offer to connect them with a human agent.
Common issues: {common_issues}""",
            
            "lead_qualifier": """You are a lead qualification specialist for {company_name}.
Your goal is to gather key information from potential customers:
- Budget range
- Timeline
- Decision makers
- Current pain points
Be conversational and not interrogative.""",
            
            "appointment_setter": """You are an appointment booking assistant for {company_name}.
Help customers schedule appointments at convenient times.
Available slots: {available_slots}
Services offered: {services}"""
        }
    
    def add_training_example(
        self,
        input_text: str,
        expected_output: str,
        data_type: TrainingDataType,
        tags: Optional[List[str]] = None
    ) -> TrainingExample:
        """Add a training example"""
        example = TrainingExample(
            input_text=input_text,
            expected_output=expected_output,
            data_type=data_type,
            tags=tags
        )
        
        self.training_data[example.id] = example
        return example
    
    def bulk_import_training_data(
        self,
        data: List[Dict],
        data_type: TrainingDataType
    ) -> Dict:
        """Bulk import training data"""
        imported = 0
        errors = []
        
        for item in data:
            try:
                self.add_training_example(
                    input_text=item.get("input", item.get("question", "")),
                    expected_output=item.get("output", item.get("answer", "")),
                    data_type=data_type,
                    tags=item.get("tags", [])
                )
                imported += 1
            except Exception as e:
                errors.append({"item": item, "error": str(e)})
        
        return {"imported": imported, "errors": errors}
    
    def approve_example(self, example_id: str, quality_score: float = 1.0) -> bool:
        """Approve a training example for use"""
        if example_id not in self.training_data:
            return False
        
        self.training_data[example_id].is_approved = True
        self.training_data[example_id].quality_score = quality_score
        return True
    
    def get_training_data(
        self,
        data_type: Optional[TrainingDataType] = None,
        approved_only: bool = False,
        tags: Optional[List[str]] = None
    ) -> List[Dict]:
        """Get training data with filters"""
        data = list(self.training_data.values())
        
        if data_type:
            data = [d for d in data if d.data_type == data_type]
        
        if approved_only:
            data = [d for d in data if d.is_approved]
        
        if tags:
            data = [d for d in data if any(t in d.tags for t in tags)]
        
        return [d.to_dict() for d in data]
    
    def create_custom_prompt(
        self,
        name: str,
        base_prompt: str,
        variables: Optional[Dict] = None
    ) -> Dict:
        """Create a custom system prompt"""
        prompt_id = str(uuid.uuid4())[:8]
        
        self.custom_prompts[prompt_id] = {
            "id": prompt_id,
            "name": name,
            "base_prompt": base_prompt,
            "variables": variables or {},
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.custom_prompts[prompt_id]
    
    def render_prompt(self, prompt_id: str, variables: Dict) -> str:
        """Render a prompt with variables"""
        if prompt_id not in self.custom_prompts:
            return ""
        
        prompt = self.custom_prompts[prompt_id]["base_prompt"]
        
        for key, value in variables.items():
            prompt = prompt.replace(f"{{{key}}}", str(value))
        
        return prompt
    
    def export_training_data(self, format: str = "jsonl") -> str:
        """Export training data for fine-tuning"""
        approved_data = [d for d in self.training_data.values() if d.is_approved]
        
        if format == "jsonl":
            lines = []
            for example in approved_data:
                lines.append(json.dumps({
                    "messages": [
                        {"role": "user", "content": example.input_text},
                        {"role": "assistant", "content": example.expected_output}
                    ]
                }))
            return "\n".join(lines)
        
        elif format == "csv":
            lines = ["input,output"]
            for example in approved_data:
                lines.append(f'"{example.input_text}","{example.expected_output}"')
            return "\n".join(lines)
        
        return json.dumps([d.to_dict() for d in approved_data])
    
    def get_training_stats(self) -> Dict:
        """Get training data statistics"""
        by_type = defaultdict(int)
        approved = 0
        
        for example in self.training_data.values():
            by_type[example.data_type.value] += 1
            if example.is_approved:
                approved += 1
        
        return {
            "total_examples": len(self.training_data),
            "approved_examples": approved,
            "by_type": dict(by_type)
        }


class SentimentAnalytics:
    """
    Sentiment Trends Analytics Service
    Tracks and analyzes sentiment patterns across calls
    """
    
    def __init__(self):
        # In production, store in time-series database
        self.sentiment_records: List[Dict] = []
    
    def record_sentiment(
        self,
        call_id: str,
        lead_id: str,
        campaign_id: Optional[str],
        sentiment: str,  # positive, negative, neutral
        confidence: float,
        timestamp: Optional[datetime] = None,
        metadata: Optional[Dict] = None
    ):
        """Record sentiment from a call"""
        record = {
            "id": str(uuid.uuid4())[:8],
            "call_id": call_id,
            "lead_id": lead_id,
            "campaign_id": campaign_id,
            "sentiment": sentiment,
            "confidence": confidence,
            "timestamp": (timestamp or datetime.utcnow()).isoformat(),
            "metadata": metadata or {}
        }
        
        self.sentiment_records.append(record)
    
    def get_sentiment_trend(
        self,
        days: int = 30,
        campaign_id: Optional[str] = None,
        granularity: str = "day"  # day, hour, week
    ) -> Dict:
        """Get sentiment trend over time"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        records = [
            r for r in self.sentiment_records
            if datetime.fromisoformat(r["timestamp"]) >= cutoff
        ]
        
        if campaign_id:
            records = [r for r in records if r["campaign_id"] == campaign_id]
        
        # Group by date
        trend = defaultdict(lambda: {"positive": 0, "negative": 0, "neutral": 0, "total": 0})
        
        for record in records:
            dt = datetime.fromisoformat(record["timestamp"])
            
            if granularity == "day":
                key = dt.strftime("%Y-%m-%d")
            elif granularity == "hour":
                key = dt.strftime("%Y-%m-%d %H:00")
            else:  # week
                key = dt.strftime("%Y-W%W")
            
            trend[key][record["sentiment"]] += 1
            trend[key]["total"] += 1
        
        # Calculate percentages
        for date, data in trend.items():
            if data["total"] > 0:
                data["positive_pct"] = round(data["positive"] / data["total"] * 100, 1)
                data["negative_pct"] = round(data["negative"] / data["total"] * 100, 1)
                data["neutral_pct"] = round(data["neutral"] / data["total"] * 100, 1)
        
        return {
            "period": f"Last {days} days",
            "granularity": granularity,
            "data": dict(trend)
        }
    
    def get_sentiment_summary(
        self,
        campaign_id: Optional[str] = None,
        days: int = 30
    ) -> Dict:
        """Get sentiment summary"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        records = [
            r for r in self.sentiment_records
            if datetime.fromisoformat(r["timestamp"]) >= cutoff
        ]
        
        if campaign_id:
            records = [r for r in records if r["campaign_id"] == campaign_id]
        
        total = len(records)
        if total == 0:
            return {"total": 0, "positive": 0, "negative": 0, "neutral": 0}
        
        positive = len([r for r in records if r["sentiment"] == "positive"])
        negative = len([r for r in records if r["sentiment"] == "negative"])
        neutral = total - positive - negative
        
        return {
            "total": total,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "positive_pct": round(positive / total * 100, 1),
            "negative_pct": round(negative / total * 100, 1),
            "neutral_pct": round(neutral / total * 100, 1),
            "avg_confidence": round(sum(r["confidence"] for r in records) / total, 2)
        }
    
    def get_top_issues(
        self,
        days: int = 30,
        limit: int = 10
    ) -> List[Dict]:
        """Get top issues from negative sentiment calls"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        negative_records = [
            r for r in self.sentiment_records
            if datetime.fromisoformat(r["timestamp"]) >= cutoff
            and r["sentiment"] == "negative"
        ]
        
        # Extract issues from metadata
        issues = defaultdict(int)
        for record in negative_records:
            issue = record.get("metadata", {}).get("issue_category", "uncategorized")
            issues[issue] += 1
        
        sorted_issues = sorted(issues.items(), key=lambda x: x[1], reverse=True)[:limit]
        
        return [{"issue": k, "count": v} for k, v in sorted_issues]


class CompetitorAnalyzer:
    """
    Competitor Analysis Service
    Tracks competitor mentions and provides insights
    """
    
    def __init__(self, competitors: Optional[List[str]] = None):
        self.competitors = competitors or []
        self.mentions: List[Dict] = []
        
        # Default competitor keywords for voice AI market
        self.default_competitors = {
            "sharyX": ["shary", "sharyx", "share x"],
            "bolna": ["bolna", "bolna ai", "bolna.ai"],
            "squadstack": ["squadstack", "squad stack"],
            "gnani": ["gnani", "gnani ai", "gnani.ai"],
            "exotel": ["exotel"],
            "ozonetel": ["ozonetel", "ozone"],
            "knowlarity": ["knowlarity"],
            "telecmi": ["telecmi", "tele cmi"]
        }
    
    def add_competitor(self, name: str, keywords: Optional[List[str]] = None):
        """Add a competitor to track"""
        self.competitors.append(name)
        if keywords:
            self.default_competitors[name.lower()] = keywords
    
    def detect_competitor_mention(self, text: str) -> List[str]:
        """Detect competitor mentions in text"""
        text_lower = text.lower()
        mentioned = []
        
        for competitor, keywords in self.default_competitors.items():
            for keyword in keywords:
                if keyword in text_lower:
                    mentioned.append(competitor)
                    break
        
        return list(set(mentioned))
    
    def record_mention(
        self,
        call_id: str,
        lead_id: str,
        text: str,
        context: str = "",
        sentiment: str = "neutral"
    ):
        """Record competitor mentions from a call"""
        competitors = self.detect_competitor_mention(text)
        
        for competitor in competitors:
            self.mentions.append({
                "id": str(uuid.uuid4())[:8],
                "call_id": call_id,
                "lead_id": lead_id,
                "competitor": competitor,
                "context": context,
                "sentiment": sentiment,
                "timestamp": datetime.utcnow().isoformat()
            })
    
    def get_mention_stats(self, days: int = 30) -> Dict:
        """Get competitor mention statistics"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        recent = [
            m for m in self.mentions
            if datetime.fromisoformat(m["timestamp"]) >= cutoff
        ]
        
        by_competitor = defaultdict(lambda: {"total": 0, "positive": 0, "negative": 0, "neutral": 0})
        
        for mention in recent:
            comp = mention["competitor"]
            by_competitor[comp]["total"] += 1
            by_competitor[comp][mention["sentiment"]] += 1
        
        return {
            "period": f"Last {days} days",
            "total_mentions": len(recent),
            "by_competitor": dict(by_competitor)
        }
    
    def get_competitor_insights(self) -> Dict:
        """Get competitive insights"""
        stats = self.get_mention_stats()
        
        insights = []
        
        for competitor, data in stats.get("by_competitor", {}).items():
            if data["total"] > 0:
                negative_pct = data["negative"] / data["total"] * 100
                
                if negative_pct > 50:
                    insights.append({
                        "competitor": competitor,
                        "insight": f"High negative sentiment ({negative_pct:.0f}%) - potential win-back opportunity",
                        "action": "Target their unsatisfied customers"
                    })
                elif data["total"] > 10:
                    insights.append({
                        "competitor": competitor,
                        "insight": f"Frequently mentioned ({data['total']} times)",
                        "action": "Prepare competitive differentiation pitch"
                    })
        
        return {
            "insights": insights,
            "stats": stats
        }
    
    def generate_battle_card(self, competitor: str) -> Dict:
        """Generate competitive battle card"""
        # In production, pull from database
        battle_cards = {
            "sharyX": {
                "name": "SharyX",
                "strengths": ["AI sales automation", "Good Hindi support"],
                "weaknesses": ["No Tamil dialects", "Limited emotions", "No built-in CRM"],
                "pricing": "₹15,000/month",
                "our_advantages": [
                    "4 Tamil dialects support",
                    "12 emotion types vs basic",
                    "Built-in CRM saves ₹5,000/month",
                    "Voice cloning included"
                ],
                "objection_handlers": {
                    "they're cheaper": "We include CRM worth ₹5,000/month. Total cost is actually lower.",
                    "we already use them": "Let's do a side-by-side Tamil demo. You'll hear the difference."
                }
            },
            "bolna": {
                "name": "Bolna AI",
                "strengths": ["Voice AI focus", "Developer friendly"],
                "weaknesses": ["No CRM", "Limited language support", "No emotion detection"],
                "pricing": "Pay per minute",
                "our_advantages": [
                    "Full CRM + Auto-dialer included",
                    "21 Indian languages",
                    "Emotion-aware responses",
                    "Fixed monthly pricing"
                ]
            }
        }
        
        return battle_cards.get(competitor.lower(), {
            "name": competitor,
            "message": "No battle card available. Record competitor info to generate."
        })
