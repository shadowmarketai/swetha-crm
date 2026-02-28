# 🎙️ VoiceFlow Marketing AI

> **Voice AI + Marketing Automation for Indian SMBs**
> 
> Combining BharatVoice AI + ZenVoice capabilities with CRM, Marketing & White-Label

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Features

### 🎙️ Voice AI Engine (BharatVoice)
- **Multi-Dialect ASR**: Tamil (Kongu, Chennai, Madurai, Tirunelveli), Hindi variants
- **Emotion Detection**: 6 emotion classes with confidence scores
- **Gen Z Slang Understanding**: 50+ slang terms across languages
- **Code-Mixing Support**: Tamil-English, Hindi-English analysis
- **Marketing Intent Classification**: Purchase, Inquiry, Complaint, Churn Risk

### 🤖 AI Assistants (ZenVoice Style)
- **Custom Personalities**: Professional, Friendly, Formal, Casual
- **Industry Templates**: Real Estate, Healthcare, E-commerce, Finance
- **Multi-LLM Support**: Claude, GPT-4, Groq (Llama)
- **Voice Customization**: ElevenLabs, PlayHT, Google TTS
- **Knowledge Base**: Custom FAQs and document training

### 📞 Indian Telephony
- **TeleCMI**: Primary provider (70% cheaper than Twilio)
- **Exotel**: IVR focused with ExoML support
- **Twilio**: International fallback
- **Automatic failover** between providers

### 🏢 CRM Integrations
- **Zoho CRM**: Lead sync, notes, tasks
- **HubSpot**: Contact management, deal tracking
- **Salesforce**: (Coming soon)

### 📱 Marketing Automation
- **Meta (Facebook) Ads**: Custom audiences, retargeting
- **Google Ads**: Customer lists, campaign management
- **WhatsApp Business**: Voice messages, templates

### 🔄 Workflow Automation
- **n8n Integration**: Pre-built workflow templates
- **Flowise**: AI workflow management
- **Custom Webhooks**: Event-driven automation

### 🏷️ White-Label System (KILLER FEATURE!)
- **Multi-Tenant Architecture**: Complete data isolation
- **Custom Branding**: Logo, colors, CSS
- **Custom Domains**: crm.youragency.com
- **Reseller Program**: 20% commission structure
- **Client Management**: Create clients under your brand

### 💳 Billing (Razorpay)
- **Subscription Plans**: ₹4,999 to ₹39,999/month
- **Usage-Based**: Extra minutes, SMS, API calls
- **Credit System**: Pre-paid wallet
- **Invoice Management**: Auto-generated invoices

---

## 💰 Pricing Structure

```
Starter: ₹4,999/month
├── 1 user, 500 leads
├── 1,000 call minutes
├── 1 AI assistant
└── Basic integrations

Growth: ₹14,999/month ⭐ BEST VALUE
├── 5 users, 5,000 leads
├── 5,000 call minutes
├── 3 AI assistants
├── All integrations
└── Automation workflows

Pro: ₹39,999/month
├── Unlimited users/leads
├── 20,000 call minutes
├── Unlimited assistants
├── White-label option
└── API access
```

### Revenue Projections
- Month 3: ₹3L (20 customers)
- Month 6: ₹15L (100 customers)
- Month 12: ₹59L (300 direct + 50 white-label)

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)
- FFmpeg (for audio processing)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/shadow-market/voiceflow-marketing-ai.git
cd voiceflow-marketing-ai

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
```

Access the dashboard at: `http://localhost:8000`

### Option 2: Manual Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up database
createdb voiceflow
python -c "from src.api.models import init_db; init_db()"

# Start the server
uvicorn src.api.server:app --reload --host 0.0.0.0 --port 8000
```

---

## 📁 Project Structure

```
voiceflow-marketing-ai/
├── src/
│   ├── voice_engine/
│   │   └── engine.py          # Core Voice AI engine
│   ├── api/
│   │   ├── server.py          # FastAPI server
│   │   └── models.py          # Database models
│   ├── integrations/
│   │   ├── crm/               # Zoho, HubSpot
│   │   ├── marketing/         # Meta, Google Ads
│   │   └── messaging/         # WhatsApp, Exotel
│   └── workflows/
│       └── n8n_workflows.py   # Pre-built workflows
├── frontend/
│   └── index.html             # React dashboard
├── deployment/
│   ├── nginx.conf
│   └── prometheus.yml
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## 🔌 API Reference

### Voice Processing

```bash
# Process audio file
curl -X POST "http://localhost:8000/api/v1/voice/process" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@customer_call.wav"

# Response
{
  "request_id": "abc123",
  "transcription": "I want to buy the red shoes...",
  "emotion": "happy",
  "emotion_confidence": 0.87,
  "intent": "purchase",
  "lead_score": 85.0,
  "dialect": "chennai",
  "gen_z_score": 0.65,
  "slang_detected": [{"word": "lit", "meaning": "amazing"}]
}
```

### CRM Sync

```bash
# Sync lead to Zoho
curl -X POST "http://localhost:8000/api/v1/crm/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "crm_type": "zoho",
    "voice_analysis_id": "abc123",
    "lead_data": {
      "phone": "+919876543210",
      "emotion": "happy",
      "intent": "purchase"
    }
  }'
```

### Marketing Trigger

```bash
# Trigger Meta retargeting
curl -X POST "http://localhost:8000/api/v1/marketing/trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "meta",
    "trigger_type": "retarget",
    "audience_segment": "high_intent",
    "voice_analysis_id": "abc123"
  }'
```

### Workflow Trigger

```bash
# Trigger n8n workflow
curl -X POST "http://localhost:8000/api/v1/workflow/trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "voice_to_lead",
    "trigger_data": {...}
  }'
```

---

## 🔧 Configuration

### Required Environment Variables

```bash
# Voice AI
WHISPER_MODEL_SIZE=base    # tiny, base, small, medium

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/voiceflow
REDIS_URL=redis://localhost:6379/0

# CRM (at least one)
ZOHO_CLIENT_ID=xxx
ZOHO_CLIENT_SECRET=xxx
ZOHO_REFRESH_TOKEN=xxx

HUBSPOT_ACCESS_TOKEN=xxx

# Marketing (at least one)
META_ACCESS_TOKEN=xxx
META_AD_ACCOUNT_ID=xxx

# Messaging
WHATSAPP_ACCESS_TOKEN=xxx
WHATSAPP_PHONE_NUMBER_ID=xxx
```

See `.env.example` for all configuration options.

---

## 📊 Pre-built Workflows

### 1. Voice to Lead Pipeline
Converts voice analysis to CRM lead with notifications.

```
Voice Webhook → Extract Data → Create Lead → Check Intent → Notify Team
```

### 2. Emotion-based Retargeting
Triggers marketing campaigns based on customer emotion.

```
Emotion Webhook → Analyze Severity → Create Audience → Send WhatsApp
```

### 3. Churn Prevention
Detects and prevents customer churn from voice signals.

```
Churn Webhook → Evaluate Risk → Alert Team → Create Offer → Schedule Callback
```

### 4. Dialect-based Campaigns
Triggers regional marketing based on detected dialect.

```
Dialect Webhook → Map to Region → Create Regional Audience → Launch Campaign
```

---

## 🎯 Use Cases

### 1. D2C E-commerce
- Process voice orders in regional languages
- Detect purchase intent and upsell opportunities
- Auto-create leads with dialect preferences

### 2. Call Centers
- Real-time emotion monitoring
- Automatic escalation for angry customers
- Regional dialect routing

### 3. Digital Marketing Agencies
- Voice-triggered retargeting campaigns
- Dialect-specific ad creatives
- Automated audience segmentation

### 4. Customer Support
- Churn prediction from voice patterns
- Win-back campaign automation
- Multi-language support

---

## 📈 Metrics & Monitoring

Access monitoring dashboards:

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (admin/voiceflow123)
- **n8n**: `http://localhost:5678` (admin/voiceflow123)

### Key Metrics

- `voiceflow_requests_total` - Total voice processing requests
- `voiceflow_processing_time_seconds` - Processing latency
- `voiceflow_emotion_distribution` - Emotion breakdown
- `voiceflow_lead_score_avg` - Average lead score
- `voiceflow_crm_sync_success_rate` - CRM sync success rate

---

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Test voice engine only
pytest tests/test_voice_engine.py -v
```

---

## 🚀 Deployment

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### AWS

```bash
# Build and push Docker image
docker build -t voiceflow-api .
docker tag voiceflow-api:latest <aws-ecr-url>/voiceflow-api:latest
docker push <aws-ecr-url>/voiceflow-api:latest

# Deploy to ECS/EKS
# See deployment/aws/ for terraform configs
```

### Vercel (Frontend only)

```bash
cd frontend
vercel --prod
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

Built with ❤️ by **SHADOW MARKET**

- **Kumaran** - Founder & Developer
- Powered by OpenAI Whisper, HuggingFace Transformers
- Inspired by BharatVoice AI, ZenVoice concepts

---

## 📞 Support

- **Email**: support@shadowmarket.ai
- **Discord**: [Join Community](https://discord.gg/shadowmarket)
- **Documentation**: [docs.voiceflow.ai](https://docs.voiceflow.ai)

---

## 🗺️ Roadmap

### Q1 2025
- [x] Core Voice AI Engine
- [x] Tamil Dialect Detection (4 dialects)
- [x] CRM Integrations (Zoho, HubSpot)
- [x] Marketing Integrations (Meta, Google)

### Q2 2025
- [ ] Telugu & Kannada support
- [ ] Voice cloning
- [ ] Real-time streaming API
- [ ] Shopify integration

### Q3 2025
- [ ] Mobile SDK (iOS/Android)
- [ ] Advanced analytics dashboard
- [ ] Custom model training UI
- [ ] WhatsApp Commerce

### Q4 2025
- [ ] On-premise deployment option
- [ ] Enterprise SSO
- [ ] Multi-tenant architecture
- [ ] API marketplace
