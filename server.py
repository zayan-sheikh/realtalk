# app.py
import os
import json
import base64
import asyncio
import wave

from flask import Flask, request, jsonify
from flask_cors import CORS
from websockets.asyncio.client import connect
from openai import OpenAI
import subprocess
import tempfile
import shutil

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
client = OpenAI()

REALTIME_WS_URL = "wss://api.openai.com/v1/realtime?intent=transcription"

# ElevenLabs voice IDs
ELEVENLABS_VOICES = {
    "masculine": "pNInz6obpgDQGcFmaJgB",  # Adam - deep masculine voice
    "feminine": "21m00Tcm4TlvDq8ikWAM"     # Rachel - clear feminine voice
}

# Path to local FFmpeg binary
FFMPEG_PATH = os.path.join(os.path.dirname(__file__), "ffmpeg-8.0.1-essentials_build", "bin", "ffmpeg.exe")
if not os.path.exists(FFMPEG_PATH):
    FFMPEG_PATH = shutil.which("ffmpeg")
    if not FFMPEG_PATH:
        raise RuntimeError("FFmpeg not found. Install ffmpeg and ensure it is on PATH.")

app = Flask(__name__)
CORS(app)

def any_audio_to_pcm16_mono_24khz(file_storage) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f_in:
        file_storage.save(f_in.name)
        in_path = f_in.name

    try:
        cmd = [
            FFMPEG_PATH, "-y",
            "-i", in_path,
            "-vn",  # No video
            "-ac", "1",  # Mono
            "-ar", "24000",  # 24kHz sample rate
            "-acodec", "pcm_s16le",  # PCM 16-bit
            "-f", "s16le",
            "-hide_banner", "-loglevel", "error",
            "pipe:1",
        ]
        out = subprocess.check_output(cmd, stderr=subprocess.PIPE)
        print(f"✅ Audio converted successfully: {len(out)} bytes")
        return out
    finally:
        os.unlink(in_path)  # Clean up temp file

def whisper_transcribe(pcm_bytes: bytes) -> str:
    """Use standard Whisper API - much simpler and more reliable"""
    # Save PCM bytes to a temporary WAV file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f_out:
        out_path = f_out.name
        
        # Write WAV header for PCM 16-bit mono 24kHz
        import wave
        with wave.open(out_path, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit = 2 bytes
            wav_file.setframerate(24000)  # 24kHz
            wav_file.writeframes(pcm_bytes)
    
    try:
        # Use Whisper API
        print("📤 Sending to Whisper API...")
        with open(out_path, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
        print(f"✅ TRANSCRIPT: {transcript}")
        return transcript.strip() if isinstance(transcript, str) else transcript.text.strip()
    finally:
        os.unlink(out_path)  # Clean up temp file

def detect_and_translate_if_needed(transcript: str) -> str:
    """
    Returns "" if English; otherwise returns English translation.
    Uses a fast text model for language detection + translation.
    """
    if not transcript or not transcript.strip():
        return ""

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You detect whether text is English. "
                    "If it is English, output exactly an empty string. "
                    "If it is not English, output only the English translation (no extra words)."
                ),
            },
            {"role": "user", "content": transcript},
        ],
    )
    return (resp.choices[0].message.content or "").strip()

@app.post("/translate_if_non_english")
def translate_if_non_english():
    print("\n" + "="*60)
    print("🎤 NEW TRANSCRIPTION REQUEST")
    print("="*60)
    if "audio" not in request.files:
        return jsonify(error="Missing form-data file field 'audio'."), 400

    try:
        print("🔄 Converting audio...")
        pcm = any_audio_to_pcm16_mono_24khz(request.files["audio"])
        print("🔄 Transcribing...")
        transcript = whisper_transcribe(pcm)
        print(f"✅ FINAL TRANSCRIPT: '{transcript}'")
        print("🔄 Checking for translation...")
        out = detect_and_translate_if_needed(transcript)
        if out:
            print(f"🌍 TRANSLATION: '{out}'")
        else:
            print("✅ Already in English, no translation needed")
        print("="*60 + "\n")
        return jsonify(transcript=transcript, english_translation_or_empty=out)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 400

@app.post("/text_to_speech")
def text_to_speech():
    """Convert text to speech using ElevenLabs TTS"""
    print("\n" + "="*60)
    print("🔊 TEXT TO SPEECH REQUEST")
    print("="*60)
    
    if not ELEVENLABS_API_KEY:
        return jsonify(error="ElevenLabs API key not configured"), 500
    
    data = request.json
    text = data.get("text")
    voice_type = data.get("voice_type", "feminine")  # "masculine" or "feminine"
    
    if not text:
        return jsonify(error="text is required"), 400
    
    try:
        # Get voice ID based on preference
        voice_id = ELEVENLABS_VOICES.get(voice_type, ELEVENLABS_VOICES["feminine"])
        print(f"🎙️ Using {voice_type} voice: {voice_id}")
        print(f"📤 Generating speech: '{text[:50]}...'")
        
        # Use ElevenLabs API directly
        import requests
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"ElevenLabs API error: {response.text}")
        
        audio_bytes = response.content
        print(f"✅ Generated {len(audio_bytes)} bytes of audio")
        print("="*60 + "\n")
        
        # Return audio as base64
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        return jsonify(audio=audio_b64)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)