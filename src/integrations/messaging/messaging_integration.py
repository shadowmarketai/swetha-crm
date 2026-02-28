"""
VoiceFlow Marketing AI - Messaging Integrations
================================================
Integrations with:
- WhatsApp Business API (Voice messages)
- Exotel IVR (Indian telephony)
- Twilio (SMS/Voice fallback)
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime
import httpx
import os
import json
import base64
import hashlib
import hmac


@dataclass
class MessageResult:
    """Result of messaging operation"""
    success: bool
    platform: str
    message_id: Optional[str] = None
    status: str = ""
    error: Optional[str] = None
    raw_response: Optional[Dict] = None


class WhatsAppVoiceHandler:
    """
    WhatsApp Business API integration for voice messages
    
    Handles:
    - Receiving voice notes
    - Downloading audio
    - Sending voice responses
    - Template messages in regional languages
    """
    
    def __init__(self):
        self.access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        self.business_account_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")
        self.verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN")
        self.base_url = "https://graph.facebook.com/v18.0"
    
    def verify_webhook(self, mode: str, token: str, challenge: str) -> Optional[str]:
        """Verify webhook subscription"""
        if mode == "subscribe" and token == self.verify_token:
            return challenge
        return None
    
    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature"""
        app_secret = os.getenv("META_APP_SECRET")
        if not app_secret:
            return True  # Skip if not configured
        
        expected = hmac.new(
            app_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(f"sha256={expected}", signature)
    
    async def download_media(self, media_id: str) -> Optional[bytes]:
        """Download media file from WhatsApp"""
        try:
            # Get media URL
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/{media_id}",
                    headers={"Authorization": f"Bearer {self.access_token}"}
                )
                
                if response.status_code != 200:
                    return None
                
                media_url = response.json().get("url")
                
                # Download media
                media_response = await client.get(
                    media_url,
                    headers={"Authorization": f"Bearer {self.access_token}"}
                )
                
                if media_response.status_code == 200:
                    return media_response.content
                    
        except Exception as e:
            print(f"Error downloading media: {e}")
        
        return None
    
    async def process_voice_message(
        self,
        message: Dict[str, Any],
        voice_processor
    ) -> Dict[str, Any]:
        """
        Process incoming voice message
        
        Args:
            message: WhatsApp message object
            voice_processor: VoiceFlowEngine instance
        
        Returns:
            Voice analysis result
        """
        # Extract voice message details
        audio_info = message.get("audio", {})
        media_id = audio_info.get("id")
        
        if not media_id:
            return {"error": "No audio media found"}
        
        # Download audio
        audio_data = await self.download_media(media_id)
        
        if not audio_data:
            return {"error": "Failed to download audio"}
        
        # Save to temp file and process
        import tempfile
        
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        try:
            # Process with voice engine
            result = voice_processor.process_audio(audio_path=temp_path)
            
            return {
                "success": True,
                "from": message.get("from"),
                "message_id": message.get("id"),
                "analysis": {
                    "transcription": result.transcription,
                    "emotion": result.emotion.value,
                    "intent": result.intent.value,
                    "dialect": result.dialect.value,
                    "lead_score": result.lead_score,
                    "gen_z_score": result.gen_z_score
                }
            }
        finally:
            os.unlink(temp_path)
    
    async def send_text_message(
        self,
        to: str,
        text: str,
        preview_url: bool = False
    ) -> MessageResult:
        """Send text message"""
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
                        "text": {
                            "body": text,
                            "preview_url": preview_url
                        }
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MessageResult(
                        success=True,
                        platform="whatsapp",
                        message_id=data.get("messages", [{}])[0].get("id"),
                        status="sent"
                    )
                else:
                    return MessageResult(
                        success=False,
                        platform="whatsapp",
                        error=response.text
                    )
        except Exception as e:
            return MessageResult(
                success=False,
                platform="whatsapp",
                error=str(e)
            )
    
    async def send_template_message(
        self,
        to: str,
        template_name: str,
        language: str = "en",
        components: List[Dict] = None
    ) -> MessageResult:
        """
        Send template message
        
        Templates for different scenarios:
        - follow_up: Post-call follow up
        - win_back: For churning customers
        - thank_you: Post-purchase
        - support: Customer support
        """
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
                    return MessageResult(
                        success=True,
                        platform="whatsapp",
                        message_id=data.get("messages", [{}])[0].get("id"),
                        status="sent"
                    )
                else:
                    return MessageResult(
                        success=False,
                        platform="whatsapp",
                        error=response.text
                    )
        except Exception as e:
            return MessageResult(
                success=False,
                platform="whatsapp",
                error=str(e)
            )
    
    async def send_audio_message(
        self,
        to: str,
        audio_url: str
    ) -> MessageResult:
        """Send audio/voice message"""
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
                    return MessageResult(
                        success=True,
                        platform="whatsapp",
                        message_id=data.get("messages", [{}])[0].get("id"),
                        status="sent"
                    )
                else:
                    return MessageResult(
                        success=False,
                        platform="whatsapp",
                        error=response.text
                    )
        except Exception as e:
            return MessageResult(
                success=False,
                platform="whatsapp",
                error=str(e)
            )
    
    # Regional language templates
    REGIONAL_TEMPLATES = {
        "ta": {  # Tamil
            "follow_up": "voiceflow_follow_up_ta",
            "win_back": "voiceflow_win_back_ta",
            "thank_you": "voiceflow_thank_you_ta",
            "support": "voiceflow_support_ta"
        },
        "hi": {  # Hindi
            "follow_up": "voiceflow_follow_up_hi",
            "win_back": "voiceflow_win_back_hi",
            "thank_you": "voiceflow_thank_you_hi",
            "support": "voiceflow_support_hi"
        },
        "en": {  # English
            "follow_up": "voiceflow_follow_up_en",
            "win_back": "voiceflow_win_back_en",
            "thank_you": "voiceflow_thank_you_en",
            "support": "voiceflow_support_en"
        }
    }
    
    async def send_regional_template(
        self,
        to: str,
        template_type: str,
        language: str,
        variables: Dict[str, str] = None
    ) -> MessageResult:
        """Send region-specific template"""
        templates = self.REGIONAL_TEMPLATES.get(language, self.REGIONAL_TEMPLATES["en"])
        template_name = templates.get(template_type, templates["follow_up"])
        
        components = []
        if variables:
            components.append({
                "type": "body",
                "parameters": [
                    {"type": "text", "text": v}
                    for v in variables.values()
                ]
            })
        
        return await self.send_template_message(
            to=to,
            template_name=template_name,
            language=language,
            components=components if components else None
        )


class ExotelIVRHandler:
    """
    Exotel IVR Integration for Indian telephony
    
    Handles:
    - Incoming call webhooks
    - Call recording download
    - IVR flow management
    - Voice AI integration
    """
    
    def __init__(self):
        self.api_key = os.getenv("EXOTEL_API_KEY")
        self.api_token = os.getenv("EXOTEL_API_TOKEN")
        self.sid = os.getenv("EXOTEL_SID")
        self.subdomain = os.getenv("EXOTEL_SUBDOMAIN", "api.exotel.com")
        self.base_url = f"https://{self.subdomain}/v1/Accounts/{self.sid}"
    
    def _get_auth(self):
        """Get basic auth tuple"""
        return (self.api_key, self.api_token)
    
    async def download_recording(self, recording_url: str) -> Optional[bytes]:
        """Download call recording"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    recording_url,
                    auth=self._get_auth()
                )
                
                if response.status_code == 200:
                    return response.content
        except Exception as e:
            print(f"Error downloading recording: {e}")
        
        return None
    
    async def process_call_webhook(
        self,
        payload: Dict[str, Any],
        voice_processor
    ) -> Dict[str, Any]:
        """
        Process Exotel call webhook
        
        Args:
            payload: Exotel webhook payload
            voice_processor: VoiceFlowEngine instance
        
        Returns:
            Processing result with IVR response
        """
        call_sid = payload.get("CallSid")
        call_status = payload.get("Status")
        recording_url = payload.get("RecordingUrl")
        from_number = payload.get("From")
        
        result = {
            "call_sid": call_sid,
            "from": from_number,
            "status": call_status
        }
        
        # Process recording if available
        if recording_url and call_status == "completed":
            audio_data = await self.download_recording(recording_url)
            
            if audio_data:
                import tempfile
                
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                    f.write(audio_data)
                    temp_path = f.name
                
                try:
                    analysis = voice_processor.process_audio(audio_path=temp_path)
                    
                    result["analysis"] = {
                        "transcription": analysis.transcription,
                        "emotion": analysis.emotion.value,
                        "intent": analysis.intent.value,
                        "dialect": analysis.dialect.value,
                        "lead_score": analysis.lead_score
                    }
                    
                    # Determine IVR response based on analysis
                    result["ivr_action"] = self._determine_ivr_action(analysis)
                    
                finally:
                    os.unlink(temp_path)
        
        return result
    
    def _determine_ivr_action(self, analysis) -> Dict[str, Any]:
        """Determine IVR action based on voice analysis"""
        emotion = analysis.emotion.value
        intent = analysis.intent.value
        
        # Route based on emotion + intent
        if emotion in ["angry", "frustrated"] or intent == "complaint":
            return {
                "action": "transfer",
                "target": "priority_agent",
                "message": "Transferring to priority support..."
            }
        elif intent == "cancel":
            return {
                "action": "transfer",
                "target": "retention_team",
                "message": "Connecting to customer success..."
            }
        elif intent == "purchase":
            return {
                "action": "transfer",
                "target": "sales_team",
                "message": "Connecting to sales..."
            }
        else:
            return {
                "action": "play",
                "message": "automated_response",
                "parameters": {
                    "transcription": analysis.transcription,
                    "language": analysis.language
                }
            }
    
    async def make_call(
        self,
        to: str,
        from_number: str = None,
        caller_id: str = None,
        url: str = None
    ) -> MessageResult:
        """Initiate outbound call"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/Calls/connect",
                    auth=self._get_auth(),
                    data={
                        "From": from_number or os.getenv("EXOTEL_FROM_NUMBER"),
                        "To": to,
                        "CallerId": caller_id or os.getenv("EXOTEL_CALLER_ID"),
                        "Url": url
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MessageResult(
                        success=True,
                        platform="exotel",
                        message_id=data.get("Call", {}).get("Sid"),
                        status="initiated"
                    )
                else:
                    return MessageResult(
                        success=False,
                        platform="exotel",
                        error=response.text
                    )
        except Exception as e:
            return MessageResult(
                success=False,
                platform="exotel",
                error=str(e)
            )
    
    async def send_sms(
        self,
        to: str,
        message: str,
        from_number: str = None
    ) -> MessageResult:
        """Send SMS via Exotel"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/Sms/send",
                    auth=self._get_auth(),
                    data={
                        "From": from_number or os.getenv("EXOTEL_SMS_NUMBER"),
                        "To": to,
                        "Body": message
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MessageResult(
                        success=True,
                        platform="exotel",
                        message_id=data.get("SMSMessage", {}).get("Sid"),
                        status="sent"
                    )
                else:
                    return MessageResult(
                        success=False,
                        platform="exotel",
                        error=response.text
                    )
        except Exception as e:
            return MessageResult(
                success=False,
                platform="exotel",
                error=str(e)
            )
    
    def generate_exoml_response(
        self,
        action: str,
        **kwargs
    ) -> str:
        """
        Generate ExoML (Exotel Markup Language) response
        
        Similar to TwiML but for Exotel
        """
        if action == "play":
            audio_url = kwargs.get("audio_url", "")
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
</Response>"""
        
        elif action == "say":
            text = kwargs.get("text", "")
            language = kwargs.get("language", "en-IN")
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="{language}">{text}</Say>
</Response>"""
        
        elif action == "record":
            callback_url = kwargs.get("callback_url", "")
            max_length = kwargs.get("max_length", 30)
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Record maxLength="{max_length}" action="{callback_url}"/>
</Response>"""
        
        elif action == "dial":
            number = kwargs.get("number", "")
            caller_id = kwargs.get("caller_id", "")
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="{caller_id}">
        <Number>{number}</Number>
    </Dial>
</Response>"""
        
        elif action == "gather":
            callback_url = kwargs.get("callback_url", "")
            num_digits = kwargs.get("num_digits", 1)
            prompt = kwargs.get("prompt", "")
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather numDigits="{num_digits}" action="{callback_url}">
        <Say>{prompt}</Say>
    </Gather>
</Response>"""
        
        else:
            return """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you for calling. Goodbye.</Say>
    <Hangup/>
</Response>"""


class TwilioHandler:
    """
    Twilio integration for SMS/Voice fallback
    """
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}"
    
    async def send_sms(
        self,
        to: str,
        message: str
    ) -> MessageResult:
        """Send SMS via Twilio"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/Messages.json",
                    auth=(self.account_sid, self.auth_token),
                    data={
                        "From": self.phone_number,
                        "To": to,
                        "Body": message
                    }
                )
                
                if response.status_code == 201:
                    data = response.json()
                    return MessageResult(
                        success=True,
                        platform="twilio",
                        message_id=data.get("sid"),
                        status=data.get("status")
                    )
                else:
                    return MessageResult(
                        success=False,
                        platform="twilio",
                        error=response.text
                    )
        except Exception as e:
            return MessageResult(
                success=False,
                platform="twilio",
                error=str(e)
            )


class MessagingFactory:
    """Factory for messaging integrations"""
    
    @staticmethod
    def get_handler(platform: str):
        """Get messaging handler by platform"""
        handlers = {
            "whatsapp": WhatsAppVoiceHandler,
            "exotel": ExotelIVRHandler,
            "twilio": TwilioHandler
        }
        
        if platform not in handlers:
            raise ValueError(f"Unsupported platform: {platform}")
        
        return handlers[platform]()


# Voice-to-Response pipeline
async def process_and_respond(
    platform: str,
    audio_data: bytes,
    from_number: str,
    voice_processor,
    respond: bool = True
) -> Dict[str, Any]:
    """
    End-to-end voice processing and response
    
    1. Process voice with VoiceFlow engine
    2. Determine appropriate response
    3. Send response via appropriate channel
    """
    import tempfile
    
    # Save audio temporarily
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_data)
        temp_path = f.name
    
    try:
        # Process audio
        analysis = voice_processor.process_audio(audio_path=temp_path)
        
        result = {
            "analysis": {
                "transcription": analysis.transcription,
                "emotion": analysis.emotion.value,
                "intent": analysis.intent.value,
                "dialect": analysis.dialect.value,
                "lead_score": analysis.lead_score,
                "sentiment": analysis.sentiment
            },
            "from": from_number,
            "platform": platform
        }
        
        # Send response if enabled
        if respond:
            handler = MessagingFactory.get_handler(platform)
            
            # Determine response based on analysis
            if analysis.emotion.value in ["angry", "frustrated"]:
                # Send empathy message
                if platform == "whatsapp":
                    response = await handler.send_regional_template(
                        to=from_number,
                        template_type="support",
                        language=analysis.language[:2],
                        variables={"name": "Customer"}
                    )
                    result["response_sent"] = response.success
            
            elif analysis.intent.value == "purchase":
                # Send purchase follow-up
                if platform == "whatsapp":
                    response = await handler.send_regional_template(
                        to=from_number,
                        template_type="follow_up",
                        language=analysis.language[:2]
                    )
                    result["response_sent"] = response.success
        
        return result
        
    finally:
        os.unlink(temp_path)
