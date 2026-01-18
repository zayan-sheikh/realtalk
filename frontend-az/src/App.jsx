import { useRef, useState } from "react";

export default function App() {
  const streamRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState("");

  const CHUNK_MS = 2500; // tune: 2000–4000

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

      // If we stopped because we’re fully done, ignore final send
      if (!isRecordingRef.current) return;

      try {
        const data = await sendBlob(blob);
        setLines((p) => [
          ...p,
          { transcript: data.transcript, en: data.english_translation_or_empty },
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

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h2>Continuous Mic → Transcribe → Translate-if-needed</h2>
      {!isRecording ? <button onClick={start}>Start</button> : <button onClick={stop}>Stop</button>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <div style={{ marginTop: 16 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div><b>Transcript:</b> {l.transcript}</div>
            {l.en ? <div><b>EN:</b> {l.en}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
