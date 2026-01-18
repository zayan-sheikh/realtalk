# app.py
import os
import json
import base64
import asyncio
import wave
import requests

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from websockets.asyncio.client import connect
from openai import OpenAI
import subprocess
import tempfile
import shutil
from io import BytesIO

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
client = OpenAI()

REALTIME_WS_URL = "wss://api.openai.com/v1/realtime?intent=transcription"

# Path to local FFmpeg binary
FFMPEG_PATH = shutil.which("ffmpeg")
if not FFMPEG_PATH:
    raise RuntimeError(
        "FFmpeg not found. Install ffmpeg and ensure it is on PATH."
    )

app = Flask(__name__)
CORS(app)



def any_audio_to_pcm16_mono_24khz(file_storage) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f_in:
        file_storage.save(f_in.name)
        in_path = f_in.name

    # Check file size
    file_size = os.path.getsize(in_path)
    if file_size == 0:
        os.unlink(in_path)
        raise ValueError("Uploaded audio file is empty")
    if file_size < 100:  # WebM files need at least some data
        os.unlink(in_path)
        raise ValueError(f"Audio file too small ({file_size} bytes), likely corrupted")

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
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            stderr_text = result.stderr.decode('utf-8', errors='replace')
            print(f"❌ FFmpeg error (exit {result.returncode}): {stderr_text}")
            raise RuntimeError(f"FFmpeg conversion failed: {stderr_text}")
        print(f"✅ Audio converted successfully: {len(result.stdout)} bytes")
        return result.stdout
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

def detect_and_translate_if_needed(transcript: str, language: str) -> str:
    f"""
    Returns "" if {language}; otherwise returns {language} translation.
    Uses a fast text model for language detection + translation.
    """
    if not transcript or not transcript.strip():
        return ""

    print(language)

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"You detect whether text is {language}. "
                    f"If it is {language}, output exactly an empty string. "
                    f"If it is not {language}, output only the {language} translation (no extra words)."
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
    
    # Get language from form data (not JSON, since we're using multipart/form-data)
    language = request.form.get("remotePreferredLanguage", "English")

    try:
        print("🔄 Converting audio...")
        pcm = any_audio_to_pcm16_mono_24khz(request.files["audio"])
        print("🔄 Transcribing...")
        transcript = whisper_transcribe(pcm)
        print(f"✅ FINAL TRANSCRIPT: '{transcript}'")
        print("🔄 Checking for translation...")
        out = detect_and_translate_if_needed(transcript, language)
        if out:
            print(f"🌍 TRANSLATION: '{out}'")
        else:
            print(f"Already in {language}, no translation needed")
        print("="*60 + "\n")
        return jsonify(transcript=transcript, english_translation_or_empty=out)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 400

# ElevenLabs voice IDs
VOICE_IDS = {
    "feminine": "21m00Tcm4TlvDq8ikWAM",  # Rachel - default feminine voice
    "masculine": "pNInz6obpgDQGcFmaJgB"  # Adam - default masculine voice
}

@app.post("/translate_text")
def translate_text():
    """
    Translate text to a target language using OpenAI
    Request JSON:
    {
        "text": "text to translate",
        "target_language": "spanish"
    }
    """
    data = request.get_json()
    text = data.get("text", "")
    target_language = data.get("target_language", "english")
    
    if not text:
        return jsonify(error="No text provided"), 400
    
    try:
        print(f"🌍 Translating to {target_language}: '{text[:50]}...'")
        
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"Translate the following text to {target_language}. Output only the translation, no extra words.",
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
        )
        translated = (resp.choices[0].message.content or "").strip()
        print(f"✅ Translation: '{translated}'")
        return jsonify(translated_text=translated)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 400

@app.post("/generate_tts")
def generate_tts():
    """
    Generate TTS audio using ElevenLabs API
    Request JSON:
    {
        "text": "text to convert to speech",
        "voice_gender": "feminine" or "masculine",
        "language": "english" (optional, defaults to english)
    }
    """
    print("\n" + "="*60)
    print("🔊 NEW TTS REQUEST")
    print("="*60)
    
    if not ELEVENLABS_API_KEY:
        print("❌ ERROR: ELEVENLABS_API_KEY not set!")
        return jsonify(error="ElevenLabs API key not configured"), 500
    
    print(f"✅ API Key present: {ELEVENLABS_API_KEY[:10]}...")
    
    data = request.get_json()
    if not data:
        print("❌ ERROR: No JSON data received")
        return jsonify(error="No JSON data received"), 400
        
    text = data.get("text", "")
    voice_gender = data.get("voice_gender", "feminine")
    
    print(f"📝 Received text: '{text[:100]}...'")
    print(f"🎤 Voice gender: {voice_gender}")
    
    if not text:
        return jsonify(error="No text provided"), 400
    
    voice_id = VOICE_IDS.get(voice_gender, VOICE_IDS["feminine"])
    
    try:
        print(f"🔄 Generating TTS for text: '{text[:50]}...'")
        print(f"🎤 Using voice: {voice_gender} ({voice_id})")
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        print(f"📡 ElevenLabs response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ TTS generated successfully")
            # Return audio file
            return send_file(
                BytesIO(response.content),
                mimetype="audio/mpeg",
                as_attachment=False
            )
        else:
            error_detail = response.text
            print(f"❌ ElevenLabs API error: {response.status_code}")
            print(f"❌ Error details: {error_detail}")
            return jsonify(error=f"ElevenLabs API error: {error_detail}"), 500
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify(error=str(e)), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)