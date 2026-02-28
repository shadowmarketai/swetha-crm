"""
VoiceFlow Marketing AI - Industry Templates
============================================
Pre-configured templates for different industries
Inspired by RSoft's industry-specific CRM approach

Industries:
- Real Estate (Developers, Brokers)
- Healthcare (Clinics, Hospitals, IVF)
- Education (Schools, Colleges, EdTech)
- Banking & Finance (DSA, Loans, Insurance)
- Automobile (Dealers, Service Centers)
- Travel & Hospitality
- E-commerce & Retail
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from enum import Enum


class Industry(Enum):
    """Supported industries"""
    REAL_ESTATE_DEVELOPER = "real_estate_developer"
    REAL_ESTATE_BROKER = "real_estate_broker"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    BANKING_FINANCE = "banking_finance"
    AUTOMOBILE = "automobile"
    TRAVEL = "travel"
    ECOMMERCE = "ecommerce"
    LOGISTICS = "logistics"
    MANUFACTURING = "manufacturing"


@dataclass
class IndustryTemplate:
    """Industry-specific template configuration"""
    id: str
    name: str
    industry: Industry
    description: str
    
    # Lead fields specific to industry
    lead_fields: List[Dict[str, Any]] = field(default_factory=list)
    
    # Pipeline stages
    pipeline_stages: List[str] = field(default_factory=list)
    
    # Voice AI prompts
    assistant_prompt: str = ""
    greeting_message: str = ""
    
    # FAQ templates
    faqs: List[Dict[str, str]] = field(default_factory=list)
    
    # Workflow templates
    workflow_templates: List[str] = field(default_factory=list)
    
    # Dashboard widgets
    dashboard_widgets: List[str] = field(default_factory=list)
    
    # Marketing campaign templates
    campaign_templates: List[Dict[str, Any]] = field(default_factory=list)
    
    # Icon and color
    icon: str = "📊"
    color: str = "#6366f1"


class IndustryTemplates:
    """
    Industry template configurations
    
    Each industry has:
    - Custom lead fields
    - Pipeline stages
    - Voice AI prompts
    - FAQs
    - Workflow templates
    - Dashboard widgets
    """
    
    TEMPLATES = {
        # =============================================
        # REAL ESTATE - DEVELOPER
        # =============================================
        Industry.REAL_ESTATE_DEVELOPER: IndustryTemplate(
            id="real_estate_developer",
            name="Real Estate Developer",
            industry=Industry.REAL_ESTATE_DEVELOPER,
            description="For real estate developers, builders, and construction companies",
            icon="🏗️",
            color="#10b981",
            
            lead_fields=[
                {"name": "project_interest", "type": "dropdown", "label": "Project Interest",
                 "options": ["2 BHK", "3 BHK", "Villa", "Plot", "Commercial"]},
                {"name": "budget_range", "type": "dropdown", "label": "Budget Range",
                 "options": ["< 50L", "50L-1Cr", "1Cr-2Cr", "2Cr-5Cr", "> 5Cr"]},
                {"name": "location_preference", "type": "text", "label": "Location Preference"},
                {"name": "possession_timeline", "type": "dropdown", "label": "Possession Timeline",
                 "options": ["Immediate", "3-6 months", "6-12 months", "1-2 years"]},
                {"name": "loan_required", "type": "boolean", "label": "Loan Required"},
                {"name": "site_visit_date", "type": "date", "label": "Site Visit Date"},
                {"name": "source_project", "type": "text", "label": "Source Project"},
            ],
            
            pipeline_stages=[
                "New Inquiry",
                "Initial Contact",
                "Site Visit Scheduled",
                "Site Visit Done",
                "Negotiation",
                "Booking Amount",
                "Documentation",
                "Registration",
                "Handover",
                "Lost"
            ],
            
            assistant_prompt="""You are a professional real estate sales assistant for a leading property developer.

Your role:
- Answer property inquiries (pricing, amenities, location, specifications)
- Qualify leads by understanding their requirements
- Schedule site visits
- Provide project information
- Collect lead details (name, phone, email, budget, timeline)

Key information to collect:
1. Name and contact details
2. Property type interest (2BHK, 3BHK, Villa, etc.)
3. Budget range
4. Possession timeline
5. Loan requirement
6. Preferred site visit date

Be professional, knowledgeable, and helpful. Keep responses concise for phone conversations.""",
            
            greeting_message="Thank you for your interest in our properties! I'm your virtual property advisor. How can I help you find your dream home today?",
            
            faqs=[
                {"question": "What projects do you have?", "answer": "We have multiple ongoing projects including apartments, villas, and plots. What type of property are you looking for?"},
                {"question": "What is the price range?", "answer": "Our properties range from 50 lakhs to 5 crores depending on the configuration and location. What's your budget range?"},
                {"question": "Can I visit the site?", "answer": "Absolutely! I can schedule a site visit for you. Which day works best - weekday or weekend?"},
                {"question": "Do you offer home loans?", "answer": "Yes, we have tie-ups with major banks for home loans up to 85% financing. Shall I connect you with our loan specialist?"},
                {"question": "What are the payment plans?", "answer": "We offer flexible payment plans including construction-linked, possession-linked, and customized options. Would you like the details?"},
            ],
            
            workflow_templates=[
                "voice_to_site_visit",
                "emotion_based_followup",
                "booking_reminder",
                "document_collection"
            ],
            
            dashboard_widgets=[
                "site_visits_today",
                "bookings_this_month",
                "lead_sources",
                "project_wise_leads",
                "conversion_funnel"
            ],
            
            campaign_templates=[
                {"name": "New Project Launch", "type": "awareness", "channels": ["whatsapp", "sms", "call"]},
                {"name": "Price Revision Alert", "type": "urgency", "channels": ["whatsapp", "email"]},
                {"name": "Site Visit Reminder", "type": "reminder", "channels": ["sms", "call"]},
                {"name": "Festival Offer", "type": "promotion", "channels": ["whatsapp", "email", "sms"]},
            ]
        ),
        
        # =============================================
        # REAL ESTATE - BROKER
        # =============================================
        Industry.REAL_ESTATE_BROKER: IndustryTemplate(
            id="real_estate_broker",
            name="Real Estate Broker/Consultant",
            industry=Industry.REAL_ESTATE_BROKER,
            description="For real estate brokers, consultants, and channel partners",
            icon="🏠",
            color="#3b82f6",
            
            lead_fields=[
                {"name": "property_type", "type": "dropdown", "label": "Property Type",
                 "options": ["Residential", "Commercial", "Rental", "Land"]},
                {"name": "budget", "type": "number", "label": "Budget (₹)"},
                {"name": "preferred_locations", "type": "text", "label": "Preferred Locations"},
                {"name": "bhk_config", "type": "dropdown", "label": "BHK Configuration",
                 "options": ["1 BHK", "2 BHK", "3 BHK", "4+ BHK", "Villa", "Plot"]},
                {"name": "purpose", "type": "dropdown", "label": "Purpose",
                 "options": ["Self Use", "Investment", "Rental Income"]},
                {"name": "ready_to_move", "type": "boolean", "label": "Ready to Move Only"},
            ],
            
            pipeline_stages=[
                "New Lead",
                "Requirements Captured",
                "Properties Shortlisted",
                "Site Visits",
                "Negotiation",
                "Deal Closed",
                "Lost"
            ],
            
            assistant_prompt="""You are a knowledgeable real estate consultant helping clients find their perfect property.

Your role:
- Understand client requirements
- Suggest suitable properties
- Schedule property viewings
- Negotiate deals
- Provide market insights

Be consultative and focus on client needs. You work with multiple developers and have access to various properties.""",
            
            greeting_message="Hello! Welcome to our real estate consultancy. I'm here to help you find the perfect property. Are you looking to buy, rent, or invest?",
            
            faqs=[
                {"question": "What areas do you cover?", "answer": "We cover all major areas in the city. Which localities are you interested in?"},
                {"question": "Do you charge brokerage?", "answer": "Yes, we charge a nominal brokerage which is industry standard. The exact amount depends on the property value."},
            ],
            
            pipeline_stages_display=["🆕 New", "📋 Requirements", "🏠 Shortlisted", "👁️ Visits", "💰 Negotiation", "✅ Closed", "❌ Lost"]
        ),
        
        # =============================================
        # HEALTHCARE
        # =============================================
        Industry.HEALTHCARE: IndustryTemplate(
            id="healthcare",
            name="Healthcare & Clinics",
            industry=Industry.HEALTHCARE,
            description="For hospitals, clinics, IVF centers, diagnostic labs",
            icon="🏥",
            color="#ef4444",
            
            lead_fields=[
                {"name": "department", "type": "dropdown", "label": "Department",
                 "options": ["General Medicine", "Cardiology", "Orthopedics", "Gynecology", "Pediatrics", "IVF", "Dental", "Eye", "Other"]},
                {"name": "patient_name", "type": "text", "label": "Patient Name"},
                {"name": "patient_age", "type": "number", "label": "Patient Age"},
                {"name": "symptoms", "type": "text", "label": "Symptoms/Concern"},
                {"name": "preferred_doctor", "type": "text", "label": "Preferred Doctor"},
                {"name": "appointment_type", "type": "dropdown", "label": "Appointment Type",
                 "options": ["First Visit", "Follow-up", "Emergency", "Second Opinion"]},
                {"name": "insurance", "type": "text", "label": "Insurance Details"},
            ],
            
            pipeline_stages=[
                "New Inquiry",
                "Appointment Scheduled",
                "Consultation Done",
                "Treatment Started",
                "Treatment Completed",
                "Follow-up Required"
            ],
            
            assistant_prompt="""You are a healthcare appointment assistant for a multi-specialty hospital.

Your role:
- Help patients book appointments
- Answer general queries about departments and services
- Collect patient information
- Provide hospital timing and location details

IMPORTANT: 
- Never provide medical diagnoses or treatment advice
- Always recommend consulting a doctor for medical concerns
- Be empathetic and reassuring

Information to collect:
1. Patient name and contact
2. Department/speciality needed
3. Brief description of concern
4. Preferred date and time
5. Insurance details if applicable""",
            
            greeting_message="Hello! Thank you for calling our healthcare center. I'm here to help you with appointments and general inquiries. How may I assist you today?",
            
            faqs=[
                {"question": "What are the OPD timings?", "answer": "Our OPD is open from 9 AM to 8 PM on weekdays and 9 AM to 2 PM on weekends."},
                {"question": "Do you accept insurance?", "answer": "Yes, we accept all major health insurance providers. Please bring your insurance card for verification."},
                {"question": "How can I book an appointment?", "answer": "I can help you book an appointment right now. Which department would you like to visit?"},
            ],
            
            workflow_templates=[
                "appointment_reminder_24h",
                "post_consultation_feedback",
                "prescription_reminder",
                "health_checkup_anniversary"
            ]
        ),
        
        # =============================================
        # EDUCATION
        # =============================================
        Industry.EDUCATION: IndustryTemplate(
            id="education",
            name="Education & EdTech",
            industry=Industry.EDUCATION,
            description="For schools, colleges, coaching centers, EdTech companies",
            icon="🎓",
            color="#8b5cf6",
            
            lead_fields=[
                {"name": "course_interest", "type": "text", "label": "Course Interest"},
                {"name": "current_qualification", "type": "text", "label": "Current Qualification"},
                {"name": "student_name", "type": "text", "label": "Student Name"},
                {"name": "student_age", "type": "number", "label": "Student Age"},
                {"name": "parent_name", "type": "text", "label": "Parent/Guardian Name"},
                {"name": "admission_year", "type": "dropdown", "label": "Admission Year",
                 "options": ["2024", "2025", "2026"]},
                {"name": "fee_budget", "type": "dropdown", "label": "Fee Budget",
                 "options": ["< 50K", "50K-1L", "1L-2L", "2L-5L", "> 5L"]},
            ],
            
            pipeline_stages=[
                "Inquiry",
                "Counseling Scheduled",
                "Counseling Done",
                "Application Submitted",
                "Fee Paid",
                "Enrolled",
                "Lost"
            ],
            
            assistant_prompt="""You are an education counselor for an educational institution.

Your role:
- Answer queries about courses and programs
- Explain admission process
- Schedule counseling sessions
- Collect student information
- Share fee structure and scholarship details

Be helpful, informative, and encouraging. Education is a big decision for families.""",
            
            greeting_message="Hello! Welcome to our admissions desk. I'm here to help you explore our courses and guide you through the admission process. What would you like to know?",
            
            faqs=[
                {"question": "What courses do you offer?", "answer": "We offer a wide range of programs. Could you tell me which field or subject interests you?"},
                {"question": "What is the fee structure?", "answer": "Our fee varies by course. Which program are you interested in so I can provide specific details?"},
                {"question": "Are scholarships available?", "answer": "Yes, we offer merit-based and need-based scholarships. I can share the eligibility criteria."},
            ]
        ),
        
        # =============================================
        # BANKING & FINANCE
        # =============================================
        Industry.BANKING_FINANCE: IndustryTemplate(
            id="banking_finance",
            name="Banking & Financial Services",
            industry=Industry.BANKING_FINANCE,
            description="For DSAs, loan agents, insurance, NBFCs, microfinance",
            icon="🏦",
            color="#f59e0b",
            
            lead_fields=[
                {"name": "product_type", "type": "dropdown", "label": "Product Type",
                 "options": ["Home Loan", "Personal Loan", "Business Loan", "Car Loan", "Credit Card", "Insurance", "Investment"]},
                {"name": "loan_amount", "type": "number", "label": "Loan Amount Required"},
                {"name": "employment_type", "type": "dropdown", "label": "Employment Type",
                 "options": ["Salaried", "Self-Employed", "Business Owner", "Professional"]},
                {"name": "monthly_income", "type": "number", "label": "Monthly Income"},
                {"name": "existing_loans", "type": "boolean", "label": "Existing Loans"},
                {"name": "cibil_score", "type": "number", "label": "CIBIL Score (if known)"},
                {"name": "property_identified", "type": "boolean", "label": "Property Identified (for HL)"},
            ],
            
            pipeline_stages=[
                "Lead",
                "Documentation",
                "Bank Submission",
                "Verification",
                "Sanction",
                "Disbursement",
                "Rejected"
            ],
            
            assistant_prompt="""You are a financial services advisor helping customers with loans and financial products.

Your role:
- Understand customer financial needs
- Explain loan products and eligibility
- Collect basic financial information
- Schedule document collection
- Provide EMI calculations

Be professional and compliant. Never make false promises about approvals. Focus on understanding requirements first.""",
            
            greeting_message="Hello! I'm your financial advisor. Whether you need a home loan, personal loan, or any other financial assistance, I'm here to help. What can I assist you with today?",
            
            faqs=[
                {"question": "What is the interest rate?", "answer": "Interest rates vary based on the loan type and your profile. Currently, home loans start from 8.5% and personal loans from 10.5%."},
                {"question": "What documents are required?", "answer": "Basic documents include ID proof, address proof, income proof, and bank statements. The exact list depends on the loan type."},
                {"question": "How long does approval take?", "answer": "Personal loans can be approved in 24-48 hours. Home loans typically take 7-10 working days."},
            ],
            
            workflow_templates=[
                "document_reminder",
                "emi_due_reminder",
                "renewal_alert",
                "cross_sell_campaign"
            ]
        ),
        
        # =============================================
        # AUTOMOBILE
        # =============================================
        Industry.AUTOMOBILE: IndustryTemplate(
            id="automobile",
            name="Automobile Sales & Service",
            industry=Industry.AUTOMOBILE,
            description="For car dealers, showrooms, service centers, used car dealers",
            icon="🚗",
            color="#06b6d4",
            
            lead_fields=[
                {"name": "vehicle_interest", "type": "text", "label": "Vehicle Model Interest"},
                {"name": "vehicle_type", "type": "dropdown", "label": "Vehicle Type",
                 "options": ["Hatchback", "Sedan", "SUV", "MUV", "Luxury", "EV", "Two Wheeler"]},
                {"name": "budget", "type": "dropdown", "label": "Budget Range",
                 "options": ["< 5L", "5L-10L", "10L-20L", "20L-50L", "> 50L"]},
                {"name": "exchange", "type": "boolean", "label": "Exchange Vehicle"},
                {"name": "finance_required", "type": "boolean", "label": "Finance Required"},
                {"name": "test_drive_date", "type": "date", "label": "Test Drive Date"},
                {"name": "purchase_timeline", "type": "dropdown", "label": "Purchase Timeline",
                 "options": ["This Week", "This Month", "1-3 Months", "Just Exploring"]},
            ],
            
            pipeline_stages=[
                "Inquiry",
                "Test Drive Scheduled",
                "Test Drive Done",
                "Quotation Shared",
                "Negotiation",
                "Booking",
                "Delivery",
                "Lost"
            ],
            
            assistant_prompt="""You are an automobile sales consultant at a leading car dealership.

Your role:
- Understand customer vehicle requirements
- Explain vehicle features and variants
- Schedule test drives
- Provide pricing and offers
- Collect customer details for follow-up

Be enthusiastic about vehicles and knowledgeable about features. Focus on understanding customer needs before pitching.""",
            
            greeting_message="Welcome to our showroom! I'm here to help you find your perfect vehicle. Are you looking for a new car, or would you like to know about our current offers?",
            
            faqs=[
                {"question": "What models are available?", "answer": "We have a complete range from hatchbacks to SUVs. What type of vehicle are you looking for?"},
                {"question": "Can I take a test drive?", "answer": "Absolutely! I can schedule a test drive for you. Which model interests you?"},
                {"question": "Do you offer exchange?", "answer": "Yes, we have an excellent exchange program. We'll evaluate your current vehicle and offer the best price."},
            ]
        ),
        
        # =============================================
        # TRAVEL & HOSPITALITY
        # =============================================
        Industry.TRAVEL: IndustryTemplate(
            id="travel",
            name="Travel & Hospitality",
            industry=Industry.TRAVEL,
            description="For travel agencies, tour operators, hotels, resorts",
            icon="✈️",
            color="#ec4899",
            
            lead_fields=[
                {"name": "destination", "type": "text", "label": "Destination"},
                {"name": "travel_type", "type": "dropdown", "label": "Travel Type",
                 "options": ["Domestic", "International", "Honeymoon", "Family", "Corporate", "Adventure"]},
                {"name": "travel_dates", "type": "text", "label": "Travel Dates"},
                {"name": "travelers_count", "type": "number", "label": "Number of Travelers"},
                {"name": "budget_per_person", "type": "number", "label": "Budget Per Person"},
                {"name": "inclusions", "type": "text", "label": "Required Inclusions"},
                {"name": "visa_required", "type": "boolean", "label": "Visa Assistance Required"},
            ],
            
            pipeline_stages=[
                "Inquiry",
                "Itinerary Shared",
                "Follow-up",
                "Confirmed",
                "Payment Done",
                "Trip Completed",
                "Lost"
            ],
            
            assistant_prompt="""You are a travel consultant helping customers plan their perfect trip.

Your role:
- Understand travel preferences and requirements
- Suggest destinations and packages
- Explain itineraries
- Collect travel details
- Handle visa and documentation queries

Be enthusiastic about travel and knowledgeable about destinations. Help create memorable experiences.""",
            
            greeting_message="Hello! Ready to plan your next adventure? I'm here to help you create unforgettable travel experiences. Where would you like to go?",
            
            faqs=[
                {"question": "What packages do you offer?", "answer": "We have packages for domestic and international destinations, from budget to luxury. What's your dream destination?"},
                {"question": "Do you handle visa?", "answer": "Yes, we provide complete visa assistance for all major countries. Which country are you planning to visit?"},
            ]
        ),
        
        # =============================================
        # E-COMMERCE
        # =============================================
        Industry.ECOMMERCE: IndustryTemplate(
            id="ecommerce",
            name="E-commerce & Retail",
            industry=Industry.ECOMMERCE,
            description="For online stores, D2C brands, retail chains",
            icon="🛒",
            color="#14b8a6",
            
            lead_fields=[
                {"name": "product_interest", "type": "text", "label": "Product Interest"},
                {"name": "order_id", "type": "text", "label": "Order ID"},
                {"name": "query_type", "type": "dropdown", "label": "Query Type",
                 "options": ["Order Status", "Returns", "Refund", "Product Query", "Complaint", "Feedback"]},
                {"name": "order_value", "type": "number", "label": "Order Value"},
            ],
            
            pipeline_stages=[
                "Query Received",
                "In Progress",
                "Resolved",
                "Escalated",
                "Closed"
            ],
            
            assistant_prompt="""You are a customer support assistant for an e-commerce platform.

Your role:
- Help with order inquiries and tracking
- Process return and refund requests
- Answer product questions
- Handle complaints professionally
- Collect feedback

Be helpful, patient, and solution-oriented. Customer satisfaction is the priority.""",
            
            greeting_message="Hello! Thank you for contacting us. I'm here to help with your orders, returns, or any product questions. How can I assist you today?",
            
            faqs=[
                {"question": "Where is my order?", "answer": "I can help track your order. Could you please provide your order ID?"},
                {"question": "How do I return?", "answer": "Returns are easy! You can initiate a return within 7 days of delivery. Would you like me to start the process?"},
                {"question": "When will I get my refund?", "answer": "Refunds are processed within 5-7 business days after we receive the returned item. Do you have an order ID?"},
            ]
        ),
    }
    
    @classmethod
    def get_template(cls, industry: Industry) -> Optional[IndustryTemplate]:
        """Get template for industry"""
        return cls.TEMPLATES.get(industry)
    
    @classmethod
    def get_all_templates(cls) -> List[IndustryTemplate]:
        """Get all templates"""
        return list(cls.TEMPLATES.values())
    
    @classmethod
    def list_industries(cls) -> List[Dict[str, str]]:
        """List all supported industries"""
        return [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "icon": t.icon,
                "color": t.color
            }
            for t in cls.TEMPLATES.values()
        ]
    
    @classmethod
    def get_lead_fields(cls, industry: Industry) -> List[Dict[str, Any]]:
        """Get lead fields for industry"""
        template = cls.TEMPLATES.get(industry)
        return template.lead_fields if template else []
    
    @classmethod
    def get_pipeline_stages(cls, industry: Industry) -> List[str]:
        """Get pipeline stages for industry"""
        template = cls.TEMPLATES.get(industry)
        return template.pipeline_stages if template else []
    
    @classmethod
    def get_assistant_config(cls, industry: Industry) -> Dict[str, str]:
        """Get AI assistant configuration for industry"""
        template = cls.TEMPLATES.get(industry)
        if not template:
            return {}
        
        return {
            "system_prompt": template.assistant_prompt,
            "greeting": template.greeting_message,
            "faqs": template.faqs
        }


# ============================================
# FastAPI Router
# ============================================

from fastapi import APIRouter
import sqlite3
import uuid
import json
from datetime import datetime

industry_router = APIRouter(prefix="/api/v1/industries", tags=["Industries"])

DB_PATH = "voiceflow.db"

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@industry_router.get("")
async def list_industries():
    """List all supported industries"""
    return {"industries": IndustryTemplates.list_industries()}


@industry_router.get("/{industry_id}")
async def get_industry_template(industry_id: str):
    """Get industry template details"""
    try:
        industry = Industry(industry_id)
        template = IndustryTemplates.get_template(industry)
        
        if not template:
            return {"error": "Industry not found"}
        
        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "icon": template.icon,
            "color": template.color,
            "lead_fields": template.lead_fields,
            "pipeline_stages": template.pipeline_stages,
            "assistant_config": {
                "prompt": template.assistant_prompt,
                "greeting": template.greeting_message,
                "faqs": template.faqs
            },
            "workflow_templates": template.workflow_templates,
            "dashboard_widgets": template.dashboard_widgets,
            "campaign_templates": template.campaign_templates
        }
    except ValueError:
        return {"error": "Invalid industry ID"}


@industry_router.get("/{industry_id}/lead-fields")
async def get_lead_fields(industry_id: str):
    """Get lead fields for industry"""
    try:
        industry = Industry(industry_id)
        return {"fields": IndustryTemplates.get_lead_fields(industry)}
    except ValueError:
        return {"error": "Invalid industry ID", "fields": []}


@industry_router.get("/{industry_id}/pipeline")
async def get_pipeline_stages(industry_id: str):
    """Get pipeline stages for industry"""
    try:
        industry = Industry(industry_id)
        return {"stages": IndustryTemplates.get_pipeline_stages(industry)}
    except ValueError:
        return {"error": "Invalid industry ID", "stages": []}


@industry_router.post("/{industry_id}/apply")
async def apply_industry_template(industry_id: str):
    """Apply an industry template - creates pre-configured assistant and campaign"""
    try:
        industry = Industry(industry_id)
        template = IndustryTemplates.get_template(industry)
        if not template:
            return {"error": "Industry not found", "success": False}

        created = {"assistant_id": None, "campaign_id": None, "industry": industry_id}
        conn = _get_db()
        cur = conn.cursor()
        now = datetime.utcnow().isoformat()

        # Create pre-configured AI assistant
        assistant_id = f"asst_{uuid.uuid4().hex[:8]}"
        try:
            cur.execute("""
                INSERT OR IGNORE INTO assistants
                (assistant_id, tenant_id, name, description, system_prompt, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                assistant_id, "demo_tenant",
                f"{template.name} AI Assistant",
                template.description,
                template.assistant_prompt,
                True, now, now
            ))
            created["assistant_id"] = assistant_id
        except Exception:
            pass

        # Create a starter campaign
        campaign_id = str(uuid.uuid4())
        try:
            cur.execute("""
                INSERT OR IGNORE INTO campaigns
                (id, name, status, dialer_type, assistant_id, total_contacts, calls_made, calls_connected,
                 conversions, start_time, tenant_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                campaign_id,
                f"{template.name} – Starter Campaign",
                "paused",
                "power",
                assistant_id,
                0, 0, 0, 0,
                now, "demo_tenant", now
            ))
            created["campaign_id"] = campaign_id
        except Exception:
            pass

        conn.commit()
        conn.close()

        return {
            "success": True,
            "message": f"{template.name} template applied successfully!",
            "created": created,
            "pipeline_stages": template.pipeline_stages,
            "next_steps": [
                f"Your {template.name} AI assistant is ready — customize the prompt in AI Assistants",
                "Upload your contact list to the starter campaign",
                "Configure your telephony provider in Settings",
                "Launch your first campaign!"
            ]
        }
    except ValueError:
        return {"error": "Invalid industry ID", "success": False}
    except Exception as e:
        return {"error": str(e), "success": False}
