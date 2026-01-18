// App.jsx
import { useRef, useState } from "react";

export default function App() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  async function start() {
    setErr("");
    setResult(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });

    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      // stop mic
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        const form = new FormData();
        form.append("audio", blob, "mic.webm");

        const res = await fetch("http://localhost:5003/translate_if_non_english", {
          method: "POST",
          body: form,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Request failed");
        setResult(data);
      } catch (e) {
        setErr(String(e.message || e));
      }
    };

    mediaRecorderRef.current = mr;
    mr.start(); // records until you stop()
    setIsRecording(true);
  }

  function stop() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();
    setIsRecording(false);
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h2>Mic → Transcribe → Translate-if-needed</h2>

      {!isRecording ? (
        <button onClick={start}>Start recording</button>
      ) : (
        <button onClick={stop}>Stop + send</button>
      )}

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <p><b>Transcript:</b> {result.transcript}</p>
          <p><b>English (or empty):</b> {result.english_translation_or_empty}</p>
        </div>
      )}
    </div>
  );
}
