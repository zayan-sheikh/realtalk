# 🎙️ ElevenLabs Voice Translation Setup

## Prerequisites

1. **ElevenLabs API Key**
   - Go to https://elevenlabs.io/
   - Sign up or log in
   - Click your profile icon (top right) → **"Profile + API Key"**
   - Copy your API key

2. **OpenAI API Key** (you already have this)

## Quick Start

### Step 1: Configure API Keys

Edit `start_with_voice.bat` and replace the placeholders:

```bat
@echo off
set OPENAI_API_KEY=sk-your-actual-openai-key-here
set ELEVENLABS_API_KEY=your-actual-elevenlabs-key-here
py server.py
```

### Step 2: Start the Backend

```powershell
.\start_with_voice.bat
```

The server will start on **http://localhost:4000**

### Step 3: Start the Frontend

In a new terminal:

```powershell
cd frontend-az
npm run dev
```

The frontend will open on **http://localhost:5173**

## How It Works

1. **Voice Selection**: Choose between masculine or feminine AI voice
2. **Real-time Translation**: Speak naturally and your speech is transcribed
3. **AI Voice Output**: Translations are spoken in natural-sounding ElevenLabs voices

## Features

- ✅ Choose between masculine and feminine voices
- ✅ Natural-sounding multilingual AI voices
- ✅ Real-time transcription and translation
- ✅ Works with all languages

## Available Voices

- **Masculine** (Adam): Deep, confident male voice
- **Feminine** (Rachel): Clear, warm female voice

## Troubleshooting

### "ElevenLabs API key not configured"
- Make sure you set `ELEVENLABS_API_KEY` in the batch file
- Restart the server after setting the key

### "Invalid API key"
- Double-check your ElevenLabs API key
- Make sure there are no extra spaces or quotes

### No audio playing
- Check browser console for errors
- Ensure your speakers/headphones are working
- Try refreshing the page

## Notes

- ElevenLabs free tier includes 10,000 characters/month
- For production use, consider upgrading to a paid plan
- The `eleven_multilingual_v2` model supports 29 languages
