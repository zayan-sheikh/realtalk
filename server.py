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

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
client = OpenAI()

REALTIME_WS_URL = "wss://api.openai.com/v1/realtime?intent=transcription"

app = Flask(__name__)
CORS(app)

def any_audio_to_pcm16_mono_24khz(file_storage) -> bytes:
    # Save upload to a temp file
    with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as f_in:
        file_storage.save(f_in.name)
        in_path = f_in.name

    # Convert to raw PCM s16le @ 24k mono
    cmd = [
        "ffmpeg", "-y",
        "-i", in_path,
        "-ac", "1",
        "-ar", "24000",
        "-f", "s16le",
        "-hide_banner", "-loglevel", "error",
        "pipe:1",
    ]
    out = subprocess.check_output(cmd)
    return out

async def realtime_transcribe(pcm_bytes: bytes) -> str:
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1",
    }

    async with connect(REALTIME_WS_URL, additional_headers=headers) as ws:
        # Configure transcription session (turn_detection null => we manually commit)
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "transcription": {"model": "gpt-4o-mini-transcribe"},
                        "turn_detection": None,
                    }
                }
            }
        }))

        # Append audio (base64) then commit
        b64_audio = base64.b64encode(pcm_bytes).decode("ascii")
        await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": b64_audio}))
        await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

        # Wait for completed transcription event
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("type") == "conversation.item.input_audio_transcription.completed":
                return msg.get("transcript", "")

def detect_and_translate_if_needed(transcript: str) -> str:
    """
    Returns "" if English; otherwise returns English translation.
    Uses a fast text model for language detection + translation.
    """
    if not transcript.strip():
        return ""

    resp = client.responses.create(
        model="gpt-4o-mini",
        input=[
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
    return (resp.output_text or "").strip()

@app.post("/translate_if_non_english")
def translate_if_non_english():
    if "audio" not in request.files:
        return jsonify(error="Missing form-data file field 'audio'."), 400

    try:
        pcm = any_audio_to_pcm16_mono_24khz(request.files["audio"])
        transcript = asyncio.run(realtime_transcribe(pcm))
        out = detect_and_translate_if_needed(transcript)
        return jsonify(transcript=transcript, english_translation_or_empty=out)
    except Exception as e:
        return jsonify(error=str(e)), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)
