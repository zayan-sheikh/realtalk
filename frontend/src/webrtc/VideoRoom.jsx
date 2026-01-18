import { useEffect, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../App";
import "./VideoRoom.css";

const PC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoRoom({ roomId }) {
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // INPUT VOLUME MONITORING
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [inputVolume, setInputVolume] = useState(0);

  const [status, setStatus] = useState("Starting...");
  const [isInitiator, setIsInitiator] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [firstCallStarted, setFirstCallStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  const SIGNAL_URL = "ws://35.183.199.110:8080";

  // TRANSCRIPTION + TRANSLATION
  const streamRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState("");
  const [remoteTranslation, setRemoteTranslation] = useState("");
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

      // Check if blob has minimum size (at least 1KB to avoid corrupted files)
      if (blob.size < 1024) {
        console.warn("Blob too small, skipping send:", blob.size, "bytes");
        return;
      }

      try {
        const data = await sendBlob(blob);
        const translation = data.english_translation_or_empty || "";
        const newLine = { transcript: data.transcript, en: translation };
        setLines((p) => [...p, newLine]);
        
        // Send the English translation to the other user if it exists
        if (translation && translation.trim() !== "" && wsRef.current?.readyState === WebSocket.OPEN && roomId) {
          try {
            wsRef.current.send(JSON.stringify({
              type: "translation",
              roomId,
              translation: translation,
            }));
            console.log("Sent translation to other user:", translation);
          } catch (sendError) {
            console.error("Failed to send translation:", sendError);
          }
        } else {
          if (!translation || translation.trim() === "") {
            console.log("No translation to send (empty)");
          } else if (wsRef.current?.readyState !== WebSocket.OPEN) {
            console.log("WebSocket not open, readyState:", wsRef.current?.readyState);
          } else if (!roomId) {
            console.log("RoomId not available");
          }
        }
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        // Start the next chunk if still recording
        // if (isRecordingRef.current) startChunk();
      }
    };

    mr.onerror = (e) => setErr(String(e.error?.message || e.message || e));
    return mr;
  }

  const isRecordingRef = useRef(false);

  // function startChunk() {
  //   if (!streamRef.current) return;
  //   mrRef.current = makeRecorder(streamRef.current);
  //   mrRef.current.start();

  //   timerRef.current = setTimeout(() => {
  //     if (mrRef.current && mrRef.current.state !== "inactive") {
  //       mrRef.current.stop();
  //     }
  //   }, CHUNK_MS);
  // }

  async function startTranscriptionTranslation() {
    setErr("");
    setLines([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    isRecordingRef.current = true;
    setIsRecording(true);
    // startChunk();
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

  // INPUT VOLUME MONITORING
  function calculateRMS(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    return Math.sqrt(sumSquares / dataArray.length);
  }

  function startInputVolumeMonitoring(stream) {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      function monitor(lastVolume = 0) {
        if (!streamRef.current || !analyserRef.current) return;
        
        const volume = calculateRMS(analyserRef.current);
        setInputVolume(volume);
        
        // Start recording if volume goes above threshold and we're not already recording
        if (volume > 0.006 && (!mrRef.current || mrRef.current.state === "inactive")) {
          console.log("Volume above threshold, starting recording");
          mrRef.current = makeRecorder(streamRef.current);
          mrRef.current.start();
        }
        
        // Stop recording if volume drops below threshold and we're currently recording
        console.log("lastVolume", lastVolume, "volume", volume);
        if (lastVolume > 0.006 && volume < 0.006) {
          console.log("Volume dropped below threshold, stopping recording");
          if (mrRef.current && mrRef.current.state === "recording") {
            // Ensure we've recorded for at least a minimum duration
            setTimeout(() => {
              if (mrRef.current && mrRef.current.state === "recording") {
                mrRef.current.stop();
              }
            }, 500); // Give it at least 500ms of data
          }
        }
        
        animationFrameRef.current = setTimeout(monitor, 2500, volume);
      }
      monitor();
    } catch (e) {
      console.warn("Failed to setup input volume monitoring:", e);
    }
  }

  function stopInputVolumeMonitoring() {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }



  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStatus("Getting camera/mic...");
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (cancelled) return;

      localStreamRef.current = localStream;
      localVideoRef.current.srcObject = localStream;

      // Start monitoring input volume
      startInputVolumeMonitoring(localStream);

      setStatus("Connecting to signaling...");
      const ws = new WebSocket(SIGNAL_URL);
      wsRef.current = ws;

      const pc = new RTCPeerConnection(PC_CONFIG);
      pcRef.current = pc;

      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      pc.ontrack = (e) => {
        remoteVideoRef.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          ws.send(JSON.stringify({ type: "ice", roomId, candidate: e.candidate }));
        }
      };

      pc.onconnectionstatechange = () => {
        setStatus(`WebRTC: ${pc.connectionState}`);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", roomId }));
        setStatus("Joined room. Waiting for peer...");
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "joined") {
          setIsInitiator(!!msg.isInitiator);
          return;
        }

        const pc = pcRef.current;
        if (!pc) return;

        if (msg.type === "end") {
          setStatus("Call ended by peer");
          setCallActive(false);
          setCallEnded(true);
          try {
            pcRef.current?.getSenders().forEach((sender) => {
              try { sender.track?.stop(); } catch {}  
            });
            pcRef.current?.close();
          } catch {}
          try {
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
          } catch {}
          remoteVideoRef.current.srcObject = null;
          
          // Auto-redirect after 2 seconds
          setTimeout(() => {
            navigate("/join");
          }, 2000);
          return;
        }

        if (msg.type === "offer") {
          setStatus("Received offer. Creating answer...");
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", roomId, sdp: pc.localDescription }));
          setCallActive(true);
          return;
        }

        if (msg.type === "answer") {
          setStatus("Received answer. Connecting...");
          await pc.setRemoteDescription(msg.sdp);
          return;
        }

        if (msg.type === "ice") {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (e) {
            console.warn("ICE add failed", e);
          }
          return;
        }

        if (msg.type === "translation") {
          const receivedTranslation = msg.translation || "";
          console.log("Received translation from other user:", receivedTranslation);
          setRemoteTranslation(receivedTranslation);
          return;
        }
      };

      ws.onerror = () => setStatus("WebSocket error (check server / URL)");
      ws.onclose = () => setStatus("WebSocket closed");
    }

    start();
    startTranscriptionTranslation();

    return () => {
      cancelled = true;
      stopInputVolumeMonitoring();
      try {
        wsRef.current?.close();
      } catch {}
      try {
        pcRef.current?.close();
      } catch {}
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, [roomId]);


  const startCall = async () => {
    const ws = wsRef.current;
    const pc = pcRef.current;
    if (!ws || !pc) return;

    if (!firstCallStarted) {
      setFirstCallStarted(true);
      setIsInitiator(true);
    }

    setStatus("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", roomId, sdp: pc.localDescription }));
    setCallActive(true);
  };

  const endCall = () => {
    setStatus("Call ended");
    setCallActive(false);
    setCallEnded(true);
    try {
      pcRef.current?.getSenders().forEach((sender) => {
        try { sender.track?.stop(); } catch {}
      });
      pcRef.current?.close();
    } catch {}
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    // notify peer to end call
    try {
      wsRef.current?.send(JSON.stringify({ type: "end", roomId }));
    } catch {}
    
    // Auto-redirect after 2 seconds
    setTimeout(() => {
      navigate("/join");
    }, 2000);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleBack = () => {
    if (callEnded) {
      navigate("/join");
      return;
    }
    
    if (window.confirm("Are you sure you want to leave the meeting?")) {
      // Clean up
      try {
        pcRef.current?.getSenders().forEach((sender) => {
          try { sender.track?.stop(); } catch {}
        });
        pcRef.current?.close();
      } catch {}
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        wsRef.current?.send(JSON.stringify({ type: "end", roomId }));
      } catch {}
      
      navigate("/join");
    }
  };

  const canStart = (!firstCallStarted && isInitiator && !callActive) || (firstCallStarted && !callActive);
  const { theme, toggleTheme } = useContext(ThemeContext);

  const wrapStyle = {
    maxWidth: 980,
    margin: "0 auto",
    padding: 16,
    display: "grid",
    gap: 14,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    color: "#0f172a",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 14px",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(8px)",
  };

  const titleStyle = { display: "grid", gap: 4 };
  const roomPill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(15, 23, 42, 0.04)",
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.75)",
    whiteSpace: "nowrap",
  };

  const statusPill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(255,255,255,0.8)",
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.8)",
    maxWidth: 420,
  };

  const dot = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: canStart ? "#10b981" : "#64748b",
    flex: "0 0 auto",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  };

  const cardStyle = {
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(255,255,255,0.85)",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    minHeight: 340,
  };

  const cardHeaderStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(15, 23, 42, 0.03)",
  };

  const labelStyle = {
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.70)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const badgeStyle = {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(255,255,255,0.8)",
    color: "rgba(15, 23, 42, 0.70)",
  };

  const videoStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    background: "linear-gradient(135deg, rgba(15, 23, 42, 0.10), rgba(15, 23, 42, 0.02))",
  };

  const controlsStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.75)",
  };

  const roleTextStyle = {
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.75)",
    lineHeight: 1.2,
  };

  const buttonStyle = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: canStart ? "#0f172a" : "rgba(15, 23, 42, 0.12)",
    color: canStart ? "white" : "rgba(15, 23, 42, 0.55)",
    fontWeight: 600,
    cursor: canStart ? "pointer" : "not-allowed",
    transition: "transform 0.05s ease, opacity 0.2s ease",
    whiteSpace: "nowrap",
    marginRight: 8,
  };

  const endButtonStyle = {
    ...buttonStyle,
    background: callActive ? "#dc2626" : "rgba(15, 23, 42, 0.12)",
    color: callActive ? "white" : "rgba(15, 23, 42, 0.55)",
    cursor: callActive ? "pointer" : "not-allowed",
    marginRight: 0,
  };

  const helperStyle = {
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.65)",
    lineHeight: 1.35,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px dashed rgba(15, 23, 42, 0.18)",
    background: "rgba(15, 23, 42, 0.02)",
  };

  return (
    <div className="video-room-wrap">
      {/* Header */}
      <div className="video-room-header">
        <button className="back-button" onClick={handleBack} title="Leave meeting">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        
        <div className="video-room-logo-section">
          <div className="video-room-logo">
            <img src="/logo.svg" alt="Logo" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = 'RT'; }} />
          </div>
          <div className="video-room-title">
            <h1><strong>REAL</strong>TALK</h1>
            <div className="video-room-pill">
              <span style={{ opacity: 0.7 }}>Room</span>
              <span style={{ fontWeight: 600 }}>{roomId}</span>
            </div>
          </div>
        </div>

        <div className="video-room-header-right">
          <div className="video-room-status-pill" title={status}>
            <span className={`video-room-dot ${canStart ? 'can-start' : 'cannot-start'}`} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {status}
            </span>
          </div>
          
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Videos */}
      <div className="video-room-grid">
        <div className="video-room-card">
          <div className="video-room-card-header">
            <div className="video-room-label">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)' }} />
              You
            </div>
            {isMuted && <span className="video-room-badge">Muted</span>}
          </div>
          <video ref={localVideoRef} autoPlay muted playsInline className="video-room-video" />
          {lines.length > 0 && lines[lines.length - 1].en && (
            <div className="video-room-translation">
              <div className="video-room-translation-label">
                TRANSLATION
              </div>
              <div>{lines[lines.length - 1].en}</div>
            </div>
          )}
        </div>

        <div className="video-room-card">
          <div className="video-room-card-header">
            <div className="video-room-label">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-secondary)' }} />
              Remote
            </div>
          </div>
          <video ref={remoteVideoRef} autoPlay playsInline className="video-room-video" />
          {remoteTranslation && (
            <div className="video-room-translation">
              <div className="video-room-translation-label">
                TRANSLATION
              </div>
              <div>{remoteTranslation}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Controls + Transcripts */}
      <div className="video-room-bottom">
        {/* Controls */}
        <div className="video-room-controls">
          <div className="video-room-button-group">
            <button 
              onClick={toggleMute}
              className="video-room-mute-button"
              title={isMuted ? "Unmute" : "Mute"}
            >
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>
          
          <button 
            onClick={startCall} 
            disabled={!canStart} 
            className={`video-room-button ${canStart ? 'can-start' : 'cannot-start'}`}
          >
            Start Call
          </button>
          <button 
            onClick={endCall} 
            disabled={!callActive} 
            className={`video-room-end-button ${callActive ? 'active' : 'inactive'}`}
          >
            End Call
          </button>
        </div>
      </div>

      {/* Helper */}
      {/* <div style={helperStyle}>
        Open the same <b>roomId</b> on a second device/tab. If the second device isn’t the same machine,
        change <b>SIGNAL_URL</b> from <b>localhost</b> to your laptop’s LAN IP.
      </div> */}

        {/* TRANSCRIPTION + TRANSLATION */}
        <div className="video-room-transcripts">
          <h3>Live Caption</h3>
          <div className="video-room-transcript-scroll">
            {lines.length > 0 ? (
              <div className="video-room-transcript-item">
                <div>{lines[lines.length - 1].en || lines[lines.length - 1].transcript}</div>
              </div>
            ) : (
              <div className="video-room-transcript-empty">
                Live captions will appear here during the call...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
