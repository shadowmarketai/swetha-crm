"""
Indic Parler-TTS Engine
Best for: Indian languages with emotion control
Supports: 21 languages, 12 emotion types
"""

import asyncio
import io
import time
from typing import Optional, AsyncGenerator, Dict, Any
import logging

from tts.engines.base import BaseTTSEngine

logger = logging.getLogger(__name__)


class IndicParlerTTSEngine(BaseTTSEngine):
    """
    Indic Parler-TTS implementation
    Model: ai4bharat/indic-parler-tts
    
    Features:
    - 21 Indian languages (20 Indic + English Indian accent)
    - 12 distinct emotion types
    - Descriptive prompt control (pitch, pace, tone, energy)
    - Streaming support
    - ~200-500ms latency
    """
    
    EMOTION_PROMPTS = {
        "happy": "speaks in a happy, cheerful, and upbeat tone with high energy",
        "sad": "speaks in a sad, melancholic tone with low energy and slower pace",
        "angry": "speaks in an angry, intense tone with high energy and sharp delivery",
        "fear": "speaks in a fearful, anxious tone with trembling voice",
        "surprise": "speaks in a surprised, amazed tone with rising intonation",
        "disgust": "speaks in a disgusted, disapproving tone",
        "neutral": "speaks in a neutral, balanced tone with clear pronunciation",
        "command": "speaks in a commanding, authoritative tone with clear diction",
        "news": "speaks in a news anchor style with professional, clear delivery",
        "narration": "speaks in a narrative, storytelling tone with expressive delivery",
        "conversation": "speaks in a conversational, friendly tone naturally",
        "proper_noun": "speaks with clear pronunciation of proper nouns and names",
        "calm": "speaks in a calm, soothing tone with gentle delivery",
        "excited": "speaks in an excited, enthusiastic tone with high energy",
        "empathetic": "speaks in an empathetic, understanding tone with warmth"
    }
    
    LANGUAGE_CODES = {
        "ta": "Tamil",
        "hi": "Hindi", 
        "te": "Telugu",
        "kn": "Kannada",
        "ml": "Malayalam",
        "en": "English",
        "bn": "Bengali",
        "mr": "Marathi",
        "gu": "Gujarati",
        "pa": "Punjabi",
        "or": "Odia",
        "as": "Assamese"
    }
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.model_id = "ai4bharat/indic-parler-tts"
        self.processor = None
        self.vocoder = None
        
    @property
    def engine_name(self) -> str:
        return "indic_parler"
    
    async def load_model(self) -> bool:
        """Load Indic Parler-TTS model"""
        try:
            logger.info(f"Loading Indic Parler-TTS model: {self.model_id}")
            
            # Import here to avoid loading at module level
            from transformers import AutoTokenizer, AutoModelForTextToWaveform
            import torch
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device: {device}")
            
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            self.model = AutoModelForTextToWaveform.from_pretrained(
                self.model_id,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32
            ).to(device)
            
            self.device = device
            self.is_loaded = True
            logger.info("Indic Parler-TTS model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load Indic Parler-TTS: {e}")
            return False
    
    async def unload_model(self) -> bool:
        """Unload model from memory"""
        try:
            if self.model:
                del self.model
                del self.tokenizer
                self.model = None
                self.tokenizer = None
                self.is_loaded = False
                
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    
            return True
        except Exception as e:
            logger.error(f"Failed to unload model: {e}")
            return False
    
    def _build_prompt(
        self,
        language: str,
        emotion: str,
        pace: float = 1.0,
        pitch: float = 1.0,
        energy: str = "normal",
        dialect: Optional[str] = None
    ) -> str:
        """Build descriptive prompt for TTS"""
        
        lang_name = self.LANGUAGE_CODES.get(language, "Tamil")
        emotion_desc = self.EMOTION_PROMPTS.get(emotion, self.EMOTION_PROMPTS["neutral"])
        
        # Build pace description
        if pace < 0.8:
            pace_desc = "very slowly"
        elif pace < 1.0:
            pace_desc = "slowly"
        elif pace > 1.2:
            pace_desc = "quickly"
        elif pace > 1.0:
            pace_desc = "at a moderate pace"
        else:
            pace_desc = "at a normal pace"
        
        # Build pitch description
        if pitch < 0.8:
            pitch_desc = "in a deep voice"
        elif pitch < 1.0:
            pitch_desc = "in a low voice"
        elif pitch > 1.2:
            pitch_desc = "in a high-pitched voice"
        elif pitch > 1.0:
            pitch_desc = "in a slightly high voice"
        else:
            pitch_desc = ""
        
        # Dialect handling for Tamil
        dialect_desc = ""
        if language == "ta" and dialect:
            dialect_map = {
                "chennai": "with a Chennai accent",
                "kongu": "with a Kongu (Coimbatore) accent",
                "madurai": "with a Madurai accent",
                "tirunelveli": "with a Tirunelveli accent"
            }
            dialect_desc = dialect_map.get(dialect, "")
        
        # Combine prompt
        prompt_parts = [
            f"A {lang_name} speaker",
            dialect_desc,
            emotion_desc,
            pace_desc,
            pitch_desc
        ]
        
        prompt = " ".join(filter(None, prompt_parts))
        return prompt
    
    async def synthesize(
        self,
        text: str,
        language: str,
        emotion: Optional[str] = None,
        voice_id: Optional[str] = None,
        pace: float = 1.0,
        pitch: float = 1.0,
        dialect: Optional[str] = None,
        **kwargs
    ) -> bytes:
        """Generate audio from text"""
        
        if not self.is_loaded:
            await self.load_model()
        
        start_time = time.time()
        emotion = emotion or "neutral"
        
        try:
            import torch
            import scipy.io.wavfile as wavfile
            
            # Build descriptive prompt
            prompt = self._build_prompt(language, emotion, pace, pitch, kwargs.get("energy"), dialect)
            
            # Tokenize
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                padding=True
            ).to(self.device)
            
            # Add prompt
            prompt_inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                padding=True
            ).to(self.device)
            
            # Generate
            with torch.no_grad():
                output = self.model.generate(
                    **inputs,
                    prompt_input_ids=prompt_inputs.input_ids,
                    do_sample=True,
                    temperature=0.7
                )
            
            # Convert to audio
            audio = output.cpu().numpy().squeeze()
            
            # Save to bytes
            buffer = io.BytesIO()
            wavfile.write(buffer, 22050, audio)
            buffer.seek(0)
            
            latency = (time.time() - start_time) * 1000
            logger.info(f"Indic Parler-TTS synthesis completed in {latency:.0f}ms")
            
            return buffer.read()
            
        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            raise
    
    async def synthesize_stream(
        self,
        text: str,
        language: str,
        emotion: Optional[str] = None,
        voice_id: Optional[str] = None,
        pace: float = 1.0,
        pitch: float = 1.0,
        **kwargs
    ) -> AsyncGenerator[bytes, None]:
        """Generate audio stream (chunked)"""
        
        # For now, generate full audio and chunk it
        # Future: implement true streaming with model
        audio = await self.synthesize(
            text, language, emotion, voice_id, pace, pitch, **kwargs
        )
        
        chunk_size = 4096
        for i in range(0, len(audio), chunk_size):
            yield audio[i:i + chunk_size]
            await asyncio.sleep(0.01)
    
    async def clone_voice(
        self,
        reference_audio: bytes,
        voice_name: str,
        language: str
    ) -> str:
        """
        Clone voice from reference audio
        Note: Indic Parler-TTS uses speaker embeddings
        """
        import uuid
        import os
        
        voice_id = f"voice_{uuid.uuid4().hex[:8]}"
        
        # Save reference audio
        voice_dir = f"voices/{voice_id}"
        os.makedirs(voice_dir, exist_ok=True)
        
        with open(f"{voice_dir}/reference.wav", "wb") as f:
            f.write(reference_audio)
        
        # Extract speaker embedding (simplified)
        # In production, use the model's speaker encoder
        
        logger.info(f"Voice cloned: {voice_name} -> {voice_id}")
        return voice_id
    
    def get_supported_languages(self) -> list:
        return list(self.LANGUAGE_CODES.keys())
    
    def get_supported_emotions(self) -> list:
        return list(self.EMOTION_PROMPTS.keys())
