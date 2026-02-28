"""
VoiceFlow Marketing AI - n8n Workflow Integration
==================================================
Pre-built workflow templates for voice-triggered automation
"""

import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import httpx
import os


@dataclass
class WorkflowNode:
    """Represents a node in n8n workflow"""
    id: str
    name: str
    type: str
    position: tuple = (0, 0)
    parameters: Dict = field(default_factory=dict)
    credentials: Dict = field(default_factory=dict)


@dataclass
class WorkflowTemplate:
    """n8n workflow template"""
    id: str
    name: str
    description: str
    nodes: List[Dict] = field(default_factory=list)
    connections: Dict = field(default_factory=dict)
    settings: Dict = field(default_factory=dict)
    
    def to_n8n_format(self) -> Dict:
        """Convert to n8n import format"""
        return {
            "name": self.name,
            "nodes": self.nodes,
            "connections": self.connections,
            "settings": self.settings,
            "active": False
        }


class N8NWorkflowManager:
    """
    Manager for n8n workflow operations
    
    Requires:
    - N8N_API_URL (e.g., http://localhost:5678/api/v1)
    - N8N_API_KEY
    """
    
    def __init__(self):
        self.api_url = os.getenv("N8N_API_URL", "http://localhost:5678/api/v1")
        self.api_key = os.getenv("N8N_API_KEY")
    
    async def create_workflow(self, template: WorkflowTemplate) -> Dict:
        """Create a workflow from template"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/workflows",
                    headers={
                        "X-N8N-API-KEY": self.api_key,
                        "Content-Type": "application/json"
                    },
                    json=template.to_n8n_format()
                )
                
                if response.status_code in [200, 201]:
                    return {
                        "success": True,
                        "workflow": response.json()
                    }
                else:
                    return {
                        "success": False,
                        "error": response.text
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def trigger_webhook(
        self,
        webhook_id: str,
        data: Dict[str, Any]
    ) -> Dict:
        """Trigger an n8n webhook"""
        try:
            # Extract base URL without /api/v1
            base_url = self.api_url.replace("/api/v1", "")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{base_url}/webhook/{webhook_id}",
                    json=data,
                    timeout=30.0
                )
                
                return {
                    "success": response.status_code == 200,
                    "response": response.json() if response.text else None
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def list_workflows(self) -> List[Dict]:
        """List all workflows"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.api_url}/workflows",
                    headers={"X-N8N-API-KEY": self.api_key}
                )
                
                if response.status_code == 200:
                    return response.json().get("data", [])
                return []
        except Exception:
            return []
    
    async def activate_workflow(self, workflow_id: str) -> bool:
        """Activate a workflow"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.api_url}/workflows/{workflow_id}",
                    headers={
                        "X-N8N-API-KEY": self.api_key,
                        "Content-Type": "application/json"
                    },
                    json={"active": True}
                )
                return response.status_code == 200
        except Exception:
            return False


# ============================================
# Pre-built Workflow Templates
# ============================================

def create_voice_to_lead_workflow() -> WorkflowTemplate:
    """
    Voice to Lead Workflow
    
    Trigger: Voice processed webhook
    Actions:
    1. Extract lead info from voice analysis
    2. Create lead in CRM
    3. Send notification to team
    4. If high intent, create task
    """
    nodes = [
        {
            "id": "webhook",
            "name": "Voice Processed Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 300],
            "parameters": {
                "path": "voice-to-lead",
                "httpMethod": "POST",
                "responseMode": "lastNode"
            }
        },
        {
            "id": "extract_data",
            "name": "Extract Lead Data",
            "type": "n8n-nodes-base.function",
            "position": [450, 300],
            "parameters": {
                "functionCode": """
const voiceData = $input.all()[0].json;

return [{
    json: {
        phone: voiceData.phone || '',
        transcription: voiceData.transcription || '',
        emotion: voiceData.emotion || 'neutral',
        intent: voiceData.intent || 'inquiry',
        lead_score: voiceData.lead_score || 0,
        dialect: voiceData.dialect || 'unknown',
        sentiment: voiceData.sentiment || 0,
        keywords: voiceData.keywords || [],
        analysis_id: voiceData.request_id,
        is_high_intent: voiceData.lead_score > 70
    }
}];
"""
            }
        },
        {
            "id": "create_lead",
            "name": "Create Lead in CRM",
            "type": "n8n-nodes-base.httpRequest",
            "position": [650, 300],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/crm/sync",
                "method": "POST",
                "authentication": "genericCredentialType",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "crm_type", "value": "={{$env.CRM_TYPE || 'zoho'}}"},
                        {"name": "voice_analysis_id", "value": "={{$json.analysis_id}}"},
                        {
                            "name": "lead_data",
                            "value": '={"phone": "{{$json.phone}}", "emotion": "{{$json.emotion}}", "intent": "{{$json.intent}}", "lead_score": {{$json.lead_score}}}'
                        }
                    ]
                }
            }
        },
        {
            "id": "check_intent",
            "name": "Check High Intent",
            "type": "n8n-nodes-base.if",
            "position": [850, 300],
            "parameters": {
                "conditions": {
                    "boolean": [{
                        "value1": "={{$json.is_high_intent}}",
                        "value2": True
                    }]
                }
            }
        },
        {
            "id": "notify_team",
            "name": "Notify Sales Team",
            "type": "n8n-nodes-base.slack",
            "position": [1050, 200],
            "parameters": {
                "channel": "={{$env.SLACK_SALES_CHANNEL || '#sales-leads'}}",
                "text": "🔥 *High-Intent Lead from Voice AI*\n\nPhone: {{$json.phone}}\nIntent: {{$json.intent}}\nEmotion: {{$json.emotion}}\nLead Score: {{$json.lead_score}}\n\nTranscription: {{$json.transcription}}"
            }
        },
        {
            "id": "create_task",
            "name": "Create Follow-up Task",
            "type": "n8n-nodes-base.httpRequest",
            "position": [1050, 400],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/crm/task",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "title", "value": "Follow up with high-intent lead"},
                        {"name": "phone", "value": "={{$json.phone}}"},
                        {"name": "priority", "value": "high"},
                        {"name": "due_in_hours", "value": "2"}
                    ]
                }
            }
        }
    ]
    
    connections = {
        "Voice Processed Webhook": {
            "main": [[{"node": "Extract Lead Data", "type": "main", "index": 0}]]
        },
        "Extract Lead Data": {
            "main": [[{"node": "Create Lead in CRM", "type": "main", "index": 0}]]
        },
        "Create Lead in CRM": {
            "main": [[{"node": "Check High Intent", "type": "main", "index": 0}]]
        },
        "Check High Intent": {
            "main": [
                [{"node": "Notify Sales Team", "type": "main", "index": 0}],
                []
            ]
        },
        "Notify Sales Team": {
            "main": [[{"node": "Create Follow-up Task", "type": "main", "index": 0}]]
        }
    }
    
    return WorkflowTemplate(
        id="voice_to_lead",
        name="Voice to Lead Pipeline",
        description="Convert voice analysis to CRM lead with notifications",
        nodes=nodes,
        connections=connections,
        settings={"saveExecutionProgress": True}
    )


def create_emotion_retarget_workflow() -> WorkflowTemplate:
    """
    Emotion-based Retargeting Workflow
    
    Trigger: Negative emotion detected
    Actions:
    1. Check emotion severity
    2. Create marketing audience
    3. Trigger appropriate campaign
    4. Send WhatsApp follow-up
    """
    nodes = [
        {
            "id": "webhook",
            "name": "Emotion Trigger Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 300],
            "parameters": {
                "path": "emotion-retarget",
                "httpMethod": "POST"
            }
        },
        {
            "id": "analyze_emotion",
            "name": "Analyze Emotion",
            "type": "n8n-nodes-base.function",
            "position": [450, 300],
            "parameters": {
                "functionCode": """
const data = $input.all()[0].json;

const emotion = data.emotion || 'neutral';
const sentiment = data.sentiment || 0;

let action = 'none';
let campaign_type = 'standard';

if (emotion === 'angry' || emotion === 'frustrated') {
    action = 'win_back';
    campaign_type = 'empathy';
} else if (emotion === 'sad') {
    action = 'support';
    campaign_type = 'care';
} else if (emotion === 'happy' || emotion === 'excited') {
    action = 'upsell';
    campaign_type = 'reward';
}

return [{
    json: {
        ...data,
        action: action,
        campaign_type: campaign_type,
        should_retarget: action !== 'none'
    }
}];
"""
            }
        },
        {
            "id": "check_retarget",
            "name": "Should Retarget?",
            "type": "n8n-nodes-base.if",
            "position": [650, 300],
            "parameters": {
                "conditions": {
                    "boolean": [{
                        "value1": "={{$json.should_retarget}}",
                        "value2": True
                    }]
                }
            }
        },
        {
            "id": "create_audience",
            "name": "Create Marketing Audience",
            "type": "n8n-nodes-base.httpRequest",
            "position": [850, 200],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/marketing/trigger",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "platform", "value": "meta"},
                        {"name": "trigger_type", "value": "={{$json.action}}"},
                        {"name": "audience_segment", "value": "={{$json.campaign_type}}"},
                        {"name": "voice_analysis_id", "value": "={{$json.request_id}}"}
                    ]
                }
            }
        },
        {
            "id": "send_whatsapp",
            "name": "Send WhatsApp Message",
            "type": "n8n-nodes-base.httpRequest",
            "position": [1050, 200],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/whatsapp/send",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "to", "value": "={{$json.phone}}"},
                        {"name": "template", "value": "={{$json.campaign_type}}_followup"},
                        {"name": "language", "value": "={{$json.dialect || 'en'}}"}
                    ]
                }
            }
        }
    ]
    
    connections = {
        "Emotion Trigger Webhook": {
            "main": [[{"node": "Analyze Emotion", "type": "main", "index": 0}]]
        },
        "Analyze Emotion": {
            "main": [[{"node": "Should Retarget?", "type": "main", "index": 0}]]
        },
        "Should Retarget?": {
            "main": [
                [{"node": "Create Marketing Audience", "type": "main", "index": 0}],
                []
            ]
        },
        "Create Marketing Audience": {
            "main": [[{"node": "Send WhatsApp Message", "type": "main", "index": 0}]]
        }
    }
    
    return WorkflowTemplate(
        id="emotion_retarget",
        name="Emotion-based Retargeting",
        description="Trigger marketing campaigns based on customer emotion",
        nodes=nodes,
        connections=connections
    )


def create_churn_prevention_workflow() -> WorkflowTemplate:
    """
    Churn Prevention Workflow
    
    Trigger: Churn risk detected
    Actions:
    1. Alert customer success team
    2. Create retention offer
    3. Schedule callback
    4. Track in CRM
    """
    nodes = [
        {
            "id": "webhook",
            "name": "Churn Risk Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 300],
            "parameters": {
                "path": "churn-prevention",
                "httpMethod": "POST"
            }
        },
        {
            "id": "check_risk",
            "name": "Evaluate Risk Level",
            "type": "n8n-nodes-base.function",
            "position": [450, 300],
            "parameters": {
                "functionCode": """
const data = $input.all()[0].json;

const intent = data.intent || '';
const emotion = data.emotion || '';
const sentiment = data.sentiment || 0;

let risk_level = 'low';
let urgency = 'normal';

if (intent === 'cancel' && emotion === 'angry') {
    risk_level = 'critical';
    urgency = 'immediate';
} else if (intent === 'cancel' || emotion === 'frustrated') {
    risk_level = 'high';
    urgency = 'urgent';
} else if (emotion === 'sad' || sentiment < -0.5) {
    risk_level = 'medium';
    urgency = 'soon';
}

return [{
    json: {
        ...data,
        risk_level: risk_level,
        urgency: urgency,
        is_critical: risk_level === 'critical'
    }
}];
"""
            }
        },
        {
            "id": "alert_team",
            "name": "Alert CS Team",
            "type": "n8n-nodes-base.slack",
            "position": [650, 200],
            "parameters": {
                "channel": "={{$env.SLACK_CS_CHANNEL || '#customer-success'}}",
                "text": "🚨 *Churn Risk Detected*\n\nRisk Level: {{$json.risk_level}}\nUrgency: {{$json.urgency}}\nPhone: {{$json.phone}}\n\nIntent: {{$json.intent}}\nEmotion: {{$json.emotion}}\n\nTranscription:\n> {{$json.transcription}}"
            }
        },
        {
            "id": "create_retention_offer",
            "name": "Create Retention Offer",
            "type": "n8n-nodes-base.httpRequest",
            "position": [650, 400],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/offers/create",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "phone", "value": "={{$json.phone}}"},
                        {"name": "offer_type", "value": "retention"},
                        {"name": "discount_percent", "value": "={{$json.risk_level === 'critical' ? 30 : 15}}"},
                        {"name": "valid_hours", "value": "={{$json.risk_level === 'critical' ? 24 : 72}}"}
                    ]
                }
            }
        },
        {
            "id": "check_critical",
            "name": "Is Critical?",
            "type": "n8n-nodes-base.if",
            "position": [850, 300],
            "parameters": {
                "conditions": {
                    "boolean": [{
                        "value1": "={{$json.is_critical}}",
                        "value2": True
                    }]
                }
            }
        },
        {
            "id": "schedule_callback",
            "name": "Schedule Immediate Callback",
            "type": "n8n-nodes-base.httpRequest",
            "position": [1050, 200],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/callback/schedule",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "phone", "value": "={{$json.phone}}"},
                        {"name": "priority", "value": "immediate"},
                        {"name": "reason", "value": "churn_prevention"},
                        {"name": "notes", "value": "={{$json.transcription}}"}
                    ]
                }
            }
        },
        {
            "id": "update_crm",
            "name": "Update CRM Status",
            "type": "n8n-nodes-base.httpRequest",
            "position": [1050, 400],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/crm/update-status",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "phone", "value": "={{$json.phone}}"},
                        {"name": "status", "value": "at_risk"},
                        {"name": "risk_level", "value": "={{$json.risk_level}}"},
                        {"name": "notes", "value": "Churn risk detected via voice analysis"}
                    ]
                }
            }
        }
    ]
    
    connections = {
        "Churn Risk Webhook": {
            "main": [[{"node": "Evaluate Risk Level", "type": "main", "index": 0}]]
        },
        "Evaluate Risk Level": {
            "main": [[
                {"node": "Alert CS Team", "type": "main", "index": 0},
                {"node": "Create Retention Offer", "type": "main", "index": 0}
            ]]
        },
        "Alert CS Team": {
            "main": [[{"node": "Is Critical?", "type": "main", "index": 0}]]
        },
        "Create Retention Offer": {
            "main": [[{"node": "Update CRM Status", "type": "main", "index": 0}]]
        },
        "Is Critical?": {
            "main": [
                [{"node": "Schedule Immediate Callback", "type": "main", "index": 0}],
                []
            ]
        }
    }
    
    return WorkflowTemplate(
        id="churn_prevention",
        name="Churn Prevention Pipeline",
        description="Detect and prevent customer churn from voice signals",
        nodes=nodes,
        connections=connections
    )


def create_dialect_campaign_workflow() -> WorkflowTemplate:
    """
    Dialect-based Campaign Workflow
    
    Trigger: New lead with detected dialect
    Actions:
    1. Identify regional dialect
    2. Select regional ad creative
    3. Add to dialect-specific audience
    4. Trigger regional campaign
    """
    nodes = [
        {
            "id": "webhook",
            "name": "Dialect Detected Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 300],
            "parameters": {
                "path": "dialect-campaign",
                "httpMethod": "POST"
            }
        },
        {
            "id": "map_dialect",
            "name": "Map Dialect to Region",
            "type": "n8n-nodes-base.function",
            "position": [450, 300],
            "parameters": {
                "functionCode": """
const data = $input.all()[0].json;

const dialectMap = {
    'kongu': { region: 'coimbatore', language: 'ta', creative: 'kongu_tamil' },
    'chennai': { region: 'chennai', language: 'ta', creative: 'chennai_tamil' },
    'madurai': { region: 'madurai', language: 'ta', creative: 'madurai_tamil' },
    'tirunelveli': { region: 'tirunelveli', language: 'ta', creative: 'nellai_tamil' },
    'hindi_standard': { region: 'delhi_ncr', language: 'hi', creative: 'hindi_standard' },
    'hindi_bhojpuri': { region: 'bihar_up', language: 'hi', creative: 'bhojpuri_style' }
};

const dialect = data.dialect || 'unknown';
const mapping = dialectMap[dialect] || { region: 'pan_india', language: 'en', creative: 'english_standard' };

return [{
    json: {
        ...data,
        target_region: mapping.region,
        ad_language: mapping.language,
        creative_type: mapping.creative,
        audience_name: `VoiceAI_${mapping.region}_${new Date().toISOString().slice(0,10)}`
    }
}];
"""
            }
        },
        {
            "id": "create_regional_audience",
            "name": "Create Regional Audience",
            "type": "n8n-nodes-base.httpRequest",
            "position": [650, 300],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/marketing/trigger",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "platform", "value": "meta"},
                        {"name": "trigger_type", "value": "regional"},
                        {"name": "audience_segment", "value": "={{$json.audience_name}}"},
                        {"name": "voice_analysis_id", "value": "={{$json.request_id}}"},
                        {
                            "name": "custom_data",
                            "value": '={"region": "{{$json.target_region}}", "language": "{{$json.ad_language}}", "creative": "{{$json.creative_type}}"}'
                        }
                    ]
                }
            }
        },
        {
            "id": "log_campaign",
            "name": "Log Campaign Trigger",
            "type": "n8n-nodes-base.httpRequest",
            "position": [850, 300],
            "parameters": {
                "url": "={{$env.VOICEFLOW_API_URL}}/api/v1/analytics/log",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "event", "value": "regional_campaign_triggered"},
                        {"name": "dialect", "value": "={{$json.dialect}}"},
                        {"name": "region", "value": "={{$json.target_region}}"},
                        {"name": "phone", "value": "={{$json.phone}}"}
                    ]
                }
            }
        }
    ]
    
    connections = {
        "Dialect Detected Webhook": {
            "main": [[{"node": "Map Dialect to Region", "type": "main", "index": 0}]]
        },
        "Map Dialect to Region": {
            "main": [[{"node": "Create Regional Audience", "type": "main", "index": 0}]]
        },
        "Create Regional Audience": {
            "main": [[{"node": "Log Campaign Trigger", "type": "main", "index": 0}]]
        }
    }
    
    return WorkflowTemplate(
        id="dialect_campaign",
        name="Dialect-based Regional Campaign",
        description="Trigger regional marketing campaigns based on detected dialect",
        nodes=nodes,
        connections=connections
    )


# Export all templates
WORKFLOW_TEMPLATES = {
    "voice_to_lead": create_voice_to_lead_workflow,
    "emotion_retarget": create_emotion_retarget_workflow,
    "churn_prevention": create_churn_prevention_workflow,
    "dialect_campaign": create_dialect_campaign_workflow
}


def get_all_templates() -> List[Dict]:
    """Get all available workflow templates"""
    return [
        {
            "id": template_id,
            "name": template_func().name,
            "description": template_func().description
        }
        for template_id, template_func in WORKFLOW_TEMPLATES.items()
    ]


async def install_all_workflows(manager: N8NWorkflowManager) -> Dict:
    """Install all workflow templates to n8n"""
    results = {}
    
    for template_id, template_func in WORKFLOW_TEMPLATES.items():
        template = template_func()
        result = await manager.create_workflow(template)
        results[template_id] = result
    
    return results
