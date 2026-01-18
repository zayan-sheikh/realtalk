# app.py
import os
import json
import base64
import asyncio
import wave
import concurrent.futures
import threading

from flask import Flask, request, jsonify
from flask_cors import CORS
from websockets.asyncio.client import connect
from openai import OpenAI
import subprocess
import tempfile
import shutil

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
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

async def realtime_transcribe_async(pcm_bytes: bytes) -> str:
    """Use OpenAI Realtime API for transcription via WebSocket"""
    print("📤 Connecting to Realtime API...")
    
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1"
    }
    
    transcript_complete = asyncio.Event()
    transcript_text = ""
    transcript_error = None
    
    async def receive_messages(ws):
        nonlocal transcript_text, transcript_error
        try:
            async for message in ws:
                event = json.loads(message)
                event_type = event.get("type")
                
                if event_type == "conversation.item.input_audio_transcription.completed":
                    transcript_text = event.get("transcript", "").strip()
                    print(f"✅ Realtime API TRANSCRIPT: {transcript_text}")
                    transcript_complete.set()
                    break
                elif event_type == "conversation.item.input_audio_transcription.delta":
                    # Accumulate delta updates if needed (optional)
                    delta = event.get("delta", "")
                    if delta:
                        transcript_text += delta
                elif event_type == "error":
                    transcript_error = event.get("error", {}).get("message", "Unknown error")
                    print(f"❌ Realtime API error: {transcript_error}")
                    transcript_complete.set()
                    break
        except Exception as e:
            transcript_error = str(e)
            print(f"❌ Error receiving messages: {e}")
            transcript_complete.set()
    
    try:
        async with connect(REALTIME_WS_URL, extra_headers=headers) as ws:
            # Configure session for transcription
            await ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "type": "transcription",
                    "audio": {
                        "input": {
                            "format": {
                                "type": "audio/pcm16",
                                "rate": 24000
                            },
                            "transcription": {
                                "model": "gpt-4o-transcribe",
                            },
                            "turn_detection": {
                                "type": "server_vad",
                                "threshold": 0.5,
                                "prefix_padding_ms": 300,
                                "silence_duration_ms": 500
                            }
                        }
                    }
                }
            }))
            
            # Start receiving messages
            receive_task = asyncio.create_task(receive_messages(ws))
            
            # Send audio in chunks (PCM16 is 2 bytes per sample, so chunk size should be multiple of 2)
            # Send in ~100ms chunks (2400 samples at 24kHz = 4800 bytes)
            chunk_size = 4800  # 100ms of audio at 24kHz PCM16
            total_bytes = len(pcm_bytes)
            sent_bytes = 0
            
            while sent_bytes < total_bytes:
                chunk_end = min(sent_bytes + chunk_size, total_bytes)
                # Ensure we don't send partial samples
                if (chunk_end - sent_bytes) % 2 != 0:
                    chunk_end -= 1
                
                if chunk_end > sent_bytes:
                    chunk = pcm_bytes[sent_bytes:chunk_end]
                    chunk_b64 = base64.b64encode(chunk).decode('utf-8')
                    
                    await ws.send(json.dumps({
                        "type": "input_audio_buffer.append",
                        "audio": chunk_b64
                    }))
                    
                    sent_bytes = chunk_end
                    # Small delay between chunks
                    await asyncio.sleep(0.01)
            
            # Commit the audio buffer to trigger transcription
            await ws.send(json.dumps({
                "type": "input_audio_buffer.commit"
            }))
            
            print(f"✅ Sent {total_bytes} bytes to Realtime API, waiting for transcript...")
            
            # Wait for transcription to complete (with timeout)
            try:
                await asyncio.wait_for(transcript_complete.wait(), timeout=30.0)
            except asyncio.TimeoutError:
                transcript_error = "Timeout waiting for transcription"
                print("❌ Timeout waiting for transcription")
            
            # Cancel receive task if still running
            if not receive_task.done():
                receive_task.cancel()
                try:
                    await receive_task
                except asyncio.CancelledError:
                    pass
            
            if transcript_error:
                raise RuntimeError(f"Realtime API error: {transcript_error}")
            
            return transcript_text if transcript_text else ""
            
    except Exception as e:
        print(f"❌ Realtime API connection error: {e}")
        raise

def realtime_transcribe(pcm_bytes: bytes) -> str:
    """Wrapper to run async Realtime API transcription in sync context"""
    try:
        # Try to get existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is running, we need to use a new thread/process
            # For Flask, we'll create a new event loop in a thread
            def run_in_thread():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    return new_loop.run_until_complete(realtime_transcribe_async(pcm_bytes))
                finally:
                    new_loop.close()
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_in_thread)
                return future.result(timeout=35)
        else:
            return loop.run_until_complete(realtime_transcribe_async(pcm_bytes))
    except RuntimeError:
        # No event loop exists, create a new one
        return asyncio.run(realtime_transcribe_async(pcm_bytes))

# Keep whisper_transcribe for comparison/testing purposes
def whisper_transcribe(pcm_bytes: bytes) -> str:
    """Use standard Whisper API - kept for comparison/testing"""
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
        print("🔄 Transcribing with Realtime API...")
        transcript = realtime_transcribe(pcm)
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)