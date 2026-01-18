import { useRef, useState } from "react";
import VoiceCloneSetup from "./VoiceCloneSetup";

export default function App() {
  const streamRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);

  const [voiceSetupComplete, setVoiceSetupComplete] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({ enabled: false, voiceType: "feminine" });
  const [isRecording, setIsRecording] = useState(false);
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState("");

  const CHUNK_MS = 2500; // tune: 2000–4000

  const playAudio = async (audioBase64) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Decode base64 to array buffer
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decode and play audio
      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (err) {
      console.error("Failed to play audio:", err);
    }
  };

  const generateTTS = async (text) => {
    if (!text) return null;
    
    try {
      const res = await fetch("http://localhost:4000/text_to_speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voice_type: voiceSettings.voiceType || "feminine"
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "TTS failed");
      
      return data.audio; // base64 audio
    } catch (err) {
      console.error("TTS error:", err);
      return null;
    }
  };

  async function sendBlob(blob) {
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");

    const res = await fetch("http://localhost:4000/translate_if_non_english", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  function makeRecorder(stream) {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const mr = new MediaRecorder(stream, { mimeType });

    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      // When stopped, build a complete file blob and send it
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      // If we stopped because we're fully done, ignore final send
      if (!isRecordingRef.current) return;

      try {
        const data = await sendBlob(blob);
        
        // Generate TTS if there's a translation
        let audioBase64 = null;
        const textToSpeak = data.english_translation_or_empty || data.transcript;
        if (textToSpeak) {
          audioBase64 = await generateTTS(textToSpeak);
          if (audioBase64) {
            playAudio(audioBase64);
          }
        }
        
        setLines((p) => [
          ...p,
          { 
            transcript: data.transcript, 
            en: data.english_translation_or_empty,
            hasAudio: !!audioBase64
          },
        ]);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        // Start the next chunk if still recording
        if (isRecordingRef.current) startChunk();
      }
    };

    mr.onerror = (e) => setErr(String(e.error?.message || e.message || e));
    return mr;
  }

  const isRecordingRef = useRef(false);

  function startChunk() {
    if (!streamRef.current) return;
    mrRef.current = makeRecorder(streamRef.current);
    mrRef.current.start();

    timerRef.current = setTimeout(() => {
      if (mrRef.current && mrRef.current.state !== "inactive") {
        mrRef.current.stop();
      }
    }, CHUNK_MS);
  }

  async function start() {
    setErr("");
    setLines([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    isRecordingRef.current = true;
    setIsRecording(true);
    startChunk();
  }

  function stop() {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
    mrRef.current = null;

    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const handleVoiceSetupComplete = (settings) => {
    setVoiceSettings(settings);
    setVoiceSetupComplete(true);
  };

  if (!voiceSetupComplete) {
    return <VoiceCloneSetup onComplete={handleVoiceSetupComplete} />;
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h2>🌍 Real-time Voice Translation</h2>
      <div style={{ background: "#f0f8ff", padding: 10, borderRadius: 4, marginBottom: 20 }}>
        <strong>Voice:</strong> {voiceSettings.voiceType === "masculine" ? "🧔 Masculine" : "👩 Feminine"} (ElevenLabs AI)
        <div><small>Natural-sounding multilingual speech</small></div>
      </div>
      
      {!isRecording ? (
        <button 
          onClick={start}
          style={{ 
            padding: "10px 20px", 
            fontSize: 16, 
            background: "#0066cc", 
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          🎤 Start Translation
        </button>
      ) : (
        <button 
          onClick={stop}
          style={{ 
            padding: "10px 20px", 
            fontSize: 16, 
            background: "#cc0000", 
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          ⏹️ Stop
        </button>
      )}
      
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      
      <div style={{ marginTop: 20 }}>
        <h3>Translation History:</h3>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {lines.map((l, i) => (
            <div key={i} style={{ 
              marginBottom: 12, 
              padding: 12, 
              background: "#f5f5f5", 
              borderRadius: 4,
              borderLeft: l.hasAudio ? "4px solid #0066cc" : "4px solid #ccc"
            }}>
              <div><strong>Original:</strong> {l.transcript}</div>
              {l.en && <div><strong>Translated:</strong> {l.en}</div>}
              {l.hasAudio && <div style={{ fontSize: 12, color: "#0066cc", marginTop: 4 }}>🔊 Audio played</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
