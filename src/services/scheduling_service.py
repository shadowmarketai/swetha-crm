"""
Call Scheduling & A/B Testing Service
Features: Schedule calls, Priority queues, Script A/B testing
"""

import asyncio
import heapq
import random
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime, timedelta
from enum import Enum
import logging
import uuid
import json

logger = logging.getLogger(__name__)


class CallPriority(int, Enum):
    URGENT = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4


class CallStatus(str, Enum):
    SCHEDULED = "scheduled"
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class ScheduledCall:
    """Scheduled Call Model"""
    
    def __init__(
        self,
        lead_id: str,
        phone: str,
        scheduled_time: datetime,
        priority: CallPriority = CallPriority.NORMAL,
        assistant_id: Optional[str] = None,
        campaign_id: Optional[str] = None,
        script_id: Optional[str] = None,
        retry_count: int = 0,
        max_retries: int = 3,
        metadata: Optional[Dict] = None
    ):
        self.id = str(uuid.uuid4())[:8]
        self.lead_id = lead_id
        self.phone = phone
        self.scheduled_time = scheduled_time
        self.priority = priority
        self.assistant_id = assistant_id
        self.campaign_id = campaign_id
        self.script_id = script_id
        self.retry_count = retry_count
        self.max_retries = max_retries
        self.metadata = metadata or {}
        self.status = CallStatus.SCHEDULED
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def __lt__(self, other):
        # For priority queue: lower priority number = higher priority
        # If same priority, earlier scheduled time first
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        return self.scheduled_time < other.scheduled_time
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "phone": self.phone,
            "scheduled_time": self.scheduled_time.isoformat(),
            "priority": self.priority.name,
            "assistant_id": self.assistant_id,
            "campaign_id": self.campaign_id,
            "script_id": self.script_id,
            "retry_count": self.retry_count,
            "status": self.status.value,
            "created_at": self.created_at.isoformat()
        }


class CallScheduler:
    """
    Call Scheduling Service with Priority Queue
    Manages scheduled calls, retries, and time-window restrictions
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        # Priority queue: (priority_value, scheduled_time, call)
        self._queue: List[ScheduledCall] = []
        self._scheduled: Dict[str, ScheduledCall] = {}
        self._processing = False
        
        # Time windows for calling (default: 9 AM to 9 PM)
        self.call_start_hour = self.config.get("call_start_hour", 9)
        self.call_end_hour = self.config.get("call_end_hour", 21)
        
        # Concurrent call limit
        self.max_concurrent_calls = self.config.get("max_concurrent_calls", 10)
        self._active_calls = 0
        
        # Callbacks
        self._on_call_ready: Optional[Callable] = None
    
    def schedule_call(
        self,
        lead_id: str,
        phone: str,
        scheduled_time: Optional[datetime] = None,
        priority: CallPriority = CallPriority.NORMAL,
        **kwargs
    ) -> ScheduledCall:
        """Schedule a call"""
        # If no time specified, schedule for next available slot
        if scheduled_time is None:
            scheduled_time = self._get_next_available_slot()
        
        # Validate time is within calling hours
        scheduled_time = self._adjust_to_calling_hours(scheduled_time)
        
        call = ScheduledCall(
            lead_id=lead_id,
            phone=phone,
            scheduled_time=scheduled_time,
            priority=priority,
            **kwargs
        )
        
        heapq.heappush(self._queue, call)
        self._scheduled[call.id] = call
        
        logger.info(f"Scheduled call {call.id} for {scheduled_time} with priority {priority.name}")
        
        return call
    
    def _get_next_available_slot(self) -> datetime:
        """Get next available calling slot"""
        now = datetime.utcnow()
        
        # If within calling hours, schedule for now
        if self.call_start_hour <= now.hour < self.call_end_hour:
            return now + timedelta(minutes=1)
        
        # Otherwise, schedule for next day's start
        if now.hour >= self.call_end_hour:
            next_day = now + timedelta(days=1)
        else:
            next_day = now
        
        return next_day.replace(hour=self.call_start_hour, minute=0, second=0, microsecond=0)
    
    def _adjust_to_calling_hours(self, dt: datetime) -> datetime:
        """Adjust datetime to calling hours"""
        if dt.hour < self.call_start_hour:
            return dt.replace(hour=self.call_start_hour, minute=0, second=0)
        elif dt.hour >= self.call_end_hour:
            next_day = dt + timedelta(days=1)
            return next_day.replace(hour=self.call_start_hour, minute=0, second=0)
        return dt
    
    def cancel_call(self, call_id: str) -> bool:
        """Cancel a scheduled call"""
        if call_id not in self._scheduled:
            return False
        
        call = self._scheduled[call_id]
        call.status = CallStatus.CANCELLED
        call.updated_at = datetime.utcnow()
        
        return True
    
    def reschedule_call(
        self, 
        call_id: str, 
        new_time: datetime,
        priority: Optional[CallPriority] = None
    ) -> Optional[ScheduledCall]:
        """Reschedule a call"""
        if call_id not in self._scheduled:
            return None
        
        old_call = self._scheduled[call_id]
        old_call.status = CallStatus.RESCHEDULED
        
        # Create new scheduled call
        new_call = self.schedule_call(
            lead_id=old_call.lead_id,
            phone=old_call.phone,
            scheduled_time=new_time,
            priority=priority or old_call.priority,
            assistant_id=old_call.assistant_id,
            campaign_id=old_call.campaign_id,
            script_id=old_call.script_id,
            metadata=old_call.metadata
        )
        
        return new_call
    
    def get_pending_calls(self, limit: int = 50) -> List[Dict]:
        """Get pending scheduled calls"""
        pending = [
            call.to_dict() for call in self._scheduled.values()
            if call.status in [CallStatus.SCHEDULED, CallStatus.QUEUED]
        ]
        
        return sorted(pending, key=lambda x: (x["priority"], x["scheduled_time"]))[:limit]
    
    def get_due_calls(self) -> List[ScheduledCall]:
        """Get calls that are due to be made"""
        now = datetime.utcnow()
        due_calls = []
        
        while self._queue:
            # Peek at the top
            call = self._queue[0]
            
            if call.scheduled_time <= now and call.status == CallStatus.SCHEDULED:
                heapq.heappop(self._queue)
                call.status = CallStatus.QUEUED
                due_calls.append(call)
            else:
                break
        
        return due_calls
    
    async def process_queue(self, call_handler: Callable):
        """Process the call queue"""
        self._processing = True
        
        while self._processing:
            due_calls = self.get_due_calls()
            
            for call in due_calls:
                if self._active_calls < self.max_concurrent_calls:
                    self._active_calls += 1
                    asyncio.create_task(self._execute_call(call, call_handler))
            
            await asyncio.sleep(10)  # Check every 10 seconds
    
    async def _execute_call(self, call: ScheduledCall, handler: Callable):
        """Execute a single call"""
        try:
            call.status = CallStatus.IN_PROGRESS
            call.updated_at = datetime.utcnow()
            
            result = await handler(call)
            
            if result.get("success"):
                call.status = CallStatus.COMPLETED
            else:
                call.status = CallStatus.FAILED
                
                # Retry if possible
                if call.retry_count < call.max_retries:
                    call.retry_count += 1
                    retry_time = datetime.utcnow() + timedelta(minutes=15 * call.retry_count)
                    self.reschedule_call(call.id, retry_time)
            
            call.updated_at = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"Call execution failed: {e}")
            call.status = CallStatus.FAILED
        finally:
            self._active_calls -= 1
    
    def stop_processing(self):
        """Stop queue processing"""
        self._processing = False
    
    def get_stats(self) -> Dict:
        """Get scheduler statistics"""
        statuses = {}
        for call in self._scheduled.values():
            status = call.status.value
            statuses[status] = statuses.get(status, 0) + 1
        
        return {
            "total_scheduled": len(self._scheduled),
            "queue_size": len(self._queue),
            "active_calls": self._active_calls,
            "by_status": statuses
        }


class ScriptVariant:
    """A/B Test Script Variant"""
    
    def __init__(
        self,
        id: str,
        name: str,
        script_content: str,
        weight: float = 1.0,
        metadata: Optional[Dict] = None
    ):
        self.id = id
        self.name = name
        self.script_content = script_content
        self.weight = weight
        self.metadata = metadata or {}
        
        # Metrics
        self.impressions = 0
        self.conversions = 0
        self.total_duration = 0
        self.positive_sentiment_count = 0
    
    @property
    def conversion_rate(self) -> float:
        if self.impressions == 0:
            return 0.0
        return self.conversions / self.impressions
    
    @property
    def avg_duration(self) -> float:
        if self.impressions == 0:
            return 0.0
        return self.total_duration / self.impressions
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "script_content": self.script_content,
            "weight": self.weight,
            "impressions": self.impressions,
            "conversions": self.conversions,
            "conversion_rate": round(self.conversion_rate * 100, 2),
            "avg_duration": round(self.avg_duration, 1)
        }


class ABTestExperiment:
    """A/B Test Experiment"""
    
    def __init__(
        self,
        id: str,
        name: str,
        description: str = "",
        variants: Optional[List[ScriptVariant]] = None,
        status: str = "draft",
        min_sample_size: int = 100,
        confidence_level: float = 0.95
    ):
        self.id = id
        self.name = name
        self.description = description
        self.variants = variants or []
        self.status = status  # draft, running, paused, completed
        self.min_sample_size = min_sample_size
        self.confidence_level = confidence_level
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.ended_at: Optional[datetime] = None
    
    def add_variant(self, variant: ScriptVariant):
        """Add a variant to the experiment"""
        self.variants.append(variant)
    
    def get_variant(self, lead_id: str) -> Optional[ScriptVariant]:
        """Get a variant for a lead using weighted random selection"""
        if not self.variants:
            return None
        
        # Deterministic selection based on lead_id for consistency
        random.seed(hash(lead_id + self.id))
        
        total_weight = sum(v.weight for v in self.variants)
        r = random.uniform(0, total_weight)
        
        cumulative = 0
        for variant in self.variants:
            cumulative += variant.weight
            if r <= cumulative:
                variant.impressions += 1
                return variant
        
        return self.variants[-1]
    
    def record_outcome(
        self,
        variant_id: str,
        converted: bool,
        duration: float = 0,
        sentiment: Optional[str] = None
    ):
        """Record call outcome for a variant"""
        for variant in self.variants:
            if variant.id == variant_id:
                if converted:
                    variant.conversions += 1
                variant.total_duration += duration
                if sentiment == "positive":
                    variant.positive_sentiment_count += 1
                break
    
    def get_winner(self) -> Optional[ScriptVariant]:
        """Get the winning variant if experiment is conclusive"""
        if self.status != "completed":
            return None
        
        # Simple winner selection based on conversion rate
        # In production, use statistical significance testing
        valid_variants = [v for v in self.variants if v.impressions >= self.min_sample_size]
        
        if not valid_variants:
            return None
        
        return max(valid_variants, key=lambda v: v.conversion_rate)
    
    def get_report(self) -> Dict:
        """Get experiment report"""
        total_impressions = sum(v.impressions for v in self.variants)
        
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "total_impressions": total_impressions,
            "variants": [v.to_dict() for v in self.variants],
            "winner": self.get_winner().to_dict() if self.get_winner() else None,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None
        }
    
    def to_dict(self) -> Dict:
        return self.get_report()


class ABTestingService:
    """A/B Testing Service for Scripts"""
    
    def __init__(self):
        # In production, store in database
        self.experiments: Dict[str, ABTestExperiment] = {}
    
    def create_experiment(
        self,
        name: str,
        description: str = "",
        variants: Optional[List[Dict]] = None,
        min_sample_size: int = 100
    ) -> ABTestExperiment:
        """Create a new A/B test experiment"""
        exp_id = str(uuid.uuid4())[:8]
        
        experiment = ABTestExperiment(
            id=exp_id,
            name=name,
            description=description,
            min_sample_size=min_sample_size
        )
        
        if variants:
            for v in variants:
                variant = ScriptVariant(
                    id=str(uuid.uuid4())[:8],
                    name=v.get("name", "Variant"),
                    script_content=v.get("script_content", ""),
                    weight=v.get("weight", 1.0)
                )
                experiment.add_variant(variant)
        
        self.experiments[exp_id] = experiment
        return experiment
    
    def start_experiment(self, experiment_id: str) -> bool:
        """Start an experiment"""
        if experiment_id not in self.experiments:
            return False
        
        exp = self.experiments[experiment_id]
        exp.status = "running"
        exp.started_at = datetime.utcnow()
        return True
    
    def stop_experiment(self, experiment_id: str) -> bool:
        """Stop an experiment"""
        if experiment_id not in self.experiments:
            return False
        
        exp = self.experiments[experiment_id]
        exp.status = "completed"
        exp.ended_at = datetime.utcnow()
        return True
    
    def get_script_for_lead(
        self,
        experiment_id: str,
        lead_id: str
    ) -> Optional[Dict]:
        """Get script variant for a lead"""
        if experiment_id not in self.experiments:
            return None
        
        exp = self.experiments[experiment_id]
        if exp.status != "running":
            return None
        
        variant = exp.get_variant(lead_id)
        if variant:
            return {
                "experiment_id": experiment_id,
                "variant_id": variant.id,
                "variant_name": variant.name,
                "script_content": variant.script_content
            }
        
        return None
    
    def record_outcome(
        self,
        experiment_id: str,
        variant_id: str,
        converted: bool,
        duration: float = 0,
        sentiment: Optional[str] = None
    ) -> bool:
        """Record call outcome"""
        if experiment_id not in self.experiments:
            return False
        
        self.experiments[experiment_id].record_outcome(
            variant_id, converted, duration, sentiment
        )
        return True
    
    def get_experiment(self, experiment_id: str) -> Optional[Dict]:
        """Get experiment details"""
        if experiment_id not in self.experiments:
            return None
        return self.experiments[experiment_id].to_dict()
    
    def list_experiments(self, status: Optional[str] = None) -> List[Dict]:
        """List all experiments"""
        experiments = list(self.experiments.values())
        
        if status:
            experiments = [e for e in experiments if e.status == status]
        
        return [e.to_dict() for e in experiments]
    
    def get_active_experiment_for_campaign(self, campaign_id: str) -> Optional[ABTestExperiment]:
        """Get active experiment for a campaign"""
        # In production, link experiments to campaigns
        for exp in self.experiments.values():
            if exp.status == "running":
                return exp
        return None
