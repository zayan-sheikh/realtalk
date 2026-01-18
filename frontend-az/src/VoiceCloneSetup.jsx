import { useState } from "react";

export default function VoiceCloneSetup({ onComplete }) {
  const [voiceType, setVoiceType] = useState(null);

  const handleSelect = (type) => {
    setVoiceType(type);
    onComplete({ enabled: true, voiceType: type });
  };

  return (
    <div style={{ 
      padding: 40, 
      maxWidth: 600, 
      margin: "auto", 
      fontFamily: "system-ui",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }}>
      <h2 style={{ textAlign: "center", marginBottom: 10 }}>🌍 Real-time Voice Translation</h2>
      <p style={{ textAlign: "center", color: "#666", marginBottom: 40 }}>
        Choose a voice for your translations
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 30 }}>
        <button
          onClick={() => handleSelect("masculine")}
          style={{
            padding: "40px 20px",
            fontSize: 18,
            background: voiceType === "masculine" ? "#0066cc" : "white",
            color: voiceType === "masculine" ? "white" : "#333",
            border: "2px solid #0066cc",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10
          }}
        >
          <div style={{ fontSize: 48 }}>🧔</div>
          <div><strong>Masculine Voice</strong></div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Deep, confident tone</div>
        </button>

        <button
          onClick={() => handleSelect("feminine")}
          style={{
            padding: "40px 20px",
            fontSize: 18,
            background: voiceType === "feminine" ? "#cc00cc" : "white",
            color: voiceType === "feminine" ? "white" : "#333",
            border: "2px solid #cc00cc",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10
          }}
        >
          <div style={{ fontSize: 48 }}>👩</div>
          <div><strong>Feminine Voice</strong></div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Clear, warm tone</div>
        </button>
      </div>

      <div style={{ 
        background: "#f0f8ff", 
        padding: 20, 
        borderRadius: 8,
        fontSize: 14,
        color: "#666"
      }}>
        <strong>How it works:</strong>
        <ul style={{ marginTop: 10, marginBottom: 0 }}>
          <li>Speak naturally into your microphone</li>
          <li>Your speech is transcribed and translated</li>
          <li>Translation is spoken in the voice you selected</li>
        </ul>
      </div>
    </div>
  );
}
