import { useEffect, useRef, useState, useCallback } from "react";

const PC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoRoom({ roomId }) {
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

  // Helper function to ensure RTCPeerConnection is active
  const ensureActiveConnection = useCallback(() => {
    let pc = pcRef.current;
    const ws = wsRef.current;
    const localStream = localStreamRef.current;

    if (!ws || !localStream) return null;

    // If PC is closed, doesn't exist, or in a bad state, create a new one
    const needsNewConnection = !pc || 
      pc.signalingState === "closed" || 
      pc.connectionState === "closed" ||
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected";
    
    if (needsNewConnection) {
      // Close old connection if it exists
      if (pc) {
        try {
          pc.close();
        } catch (e) {
          console.warn("Error closing old PC:", e);
        }
      }

      pc = new RTCPeerConnection(PC_CONFIG);
      pcRef.current = pc;

      // Ensure local video element has the stream
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }

      // Re-add tracks - check if they're still live, if not, get new ones
      const tracksToAdd = [];
      localStream.getTracks().forEach((t) => {
        if (t.readyState === "live") {
          tracksToAdd.push(t);
        }
      });

      // If tracks are not live, we need to get new media
      if (tracksToAdd.length === 0) {
        console.warn("Local stream tracks are not live, need to get new media");
        return null;
      }

      tracksToAdd.forEach((t) => {
        try {
          pc.addTrack(t, localStream);
        } catch (e) {
          console.warn("Error adding track:", e);
        }
      });

      // Re-setup event handlers
      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ice", roomId, candidate: e.candidate }));
        }
      };

      pc.onconnectionstatechange = () => {
        setStatus(`WebRTC: ${pc.connectionState}`);
      };
    }

    return pc;
  }, [roomId]);

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

        if (msg.type === "promote_to_initiator") {
          setIsInitiator(true);
          setStatus("Became initiator. You can start the call.");
          return;
        }

        if (msg.type === "end") {
          setStatus("Call ended by peer");
          setCallActive(false);
          try {
            if (pcRef.current) {
              // Don't stop the tracks, just close the connection
              pcRef.current.close();
              // Don't set to null, we'll check if it's closed and recreate it
            }
          } catch {}
          // Clear remote video but keep local video stream
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          // Ensure local video is still showing
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          return;
        }

        if (msg.type === "offer") {
          // Ensure local video is showing
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Ensure connection is active before handling offer
          const activePc = ensureActiveConnection();
          if (!activePc) {
            setStatus("Failed to create connection. Please try again.");
            return;
          }
          
          setStatus("Received offer. Creating answer...");
          try {
            await activePc.setRemoteDescription(msg.sdp);
            const answer = await activePc.createAnswer();
            await activePc.setLocalDescription(answer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "answer", roomId, sdp: activePc.localDescription }));
            }
            setCallActive(true);
          } catch (error) {
            console.error("Failed to handle offer:", error);
            setStatus("Failed to handle offer. Please try again.");
          }
          return;
        }

        if (msg.type === "answer") {
          // Ensure local video is showing
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Ensure connection is active before handling answer
          const activePc = ensureActiveConnection();
          if (!activePc) {
            setStatus("Failed to create connection. Please try again.");
            return;
          }
          
          setStatus("Received answer. Connecting...");
          try {
            await activePc.setRemoteDescription(msg.sdp);
          } catch (error) {
            console.error("Failed to set remote description:", error);
            setStatus("Failed to set remote description. Please try again.");
          }
          return;
        }

        if (msg.type === "ice") {
          const activePc = ensureActiveConnection();
          if (!activePc) return;
          
          try {
            await activePc.addIceCandidate(msg.candidate);
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
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatus("WebSocket not ready. Please wait...");
      return;
    }

    // Ensure local video is showing
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    const pc = ensureActiveConnection();
    if (!pc) {
      setStatus("Failed to create connection. Please try again.");
      return;
    }

    if (!firstCallStarted) {
      setFirstCallStarted(true);
      setIsInitiator(true);
    }

    setStatus("Creating offer...");
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", roomId, sdp: pc.localDescription }));
      setCallActive(true);
    } catch (error) {
      console.error("Failed to create offer:", error);
      setStatus("Failed to start call. Please try again.");
    }
  };

  const endCall = () => {
    setStatus("Call ended");
    setCallActive(false);
    try {
      if (pcRef.current) {
        // Don't stop the tracks, just close the connection
        pcRef.current.close();
        // Don't set to null, we'll check if it's closed and recreate it
      }
    } catch {}
    // Clear remote video but keep local video stream
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    // Ensure local video is still showing
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    // notify peer to end call
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "end", roomId }));
      }
    } catch {}
  };

  const canStart = (!firstCallStarted && isInitiator && !callActive) || (firstCallStarted && !callActive);

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
    <div style={wrapStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleStyle}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Video Room</div>
          <div style={roomPill}>
            <span style={{ opacity: 0.7 }}>Room</span>
            <span style={{ fontWeight: 600 }}>{roomId}</span>
          </div>
        </div>

        <div style={statusPill} title={status}>
          <span style={dot} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {status}
          </span>
        </div>
      </div>

      {/* Videos */}
      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={labelStyle}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#3b82f6" }} />
              Local
            </div>
            <span style={badgeStyle}>Muted</span>
          </div>
          <video ref={localVideoRef} autoPlay muted playsInline style={videoStyle} />
          {lines.length > 0 && lines[lines.length - 1].en && (
            <div style={{
              padding: "12px",
              background: "rgba(15, 23, 42, 0.05)",
              borderTop: "1px solid rgba(15, 23, 42, 0.10)",
              fontSize: 14,
              color: "rgba(15, 23, 42, 0.85)",
              lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", marginBottom: 4, fontWeight: 600 }}>
                TRANSLATION
              </div>
              <div>{lines[lines.length - 1].en}</div>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={labelStyle}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#a855f7" }} />
              Remote
            </div>
            <span style={badgeStyle}>Live</span>
          </div>
          <video ref={remoteVideoRef} autoPlay playsInline style={videoStyle} />
          {remoteTranslation && (
            <div style={{
              padding: "12px",
              background: "rgba(15, 23, 42, 0.05)",
              borderTop: "1px solid rgba(15, 23, 42, 0.10)",
              fontSize: 14,
              color: "rgba(15, 23, 42, 0.85)",
              lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", marginBottom: 4, fontWeight: 600 }}>
                TRANSLATION
              </div>
              <div>{remoteTranslation}</div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={controlsStyle}>
        <div style={roleTextStyle}>
          <div>
            <b>Role:</b>{" "}
            {isInitiator ? "Initiator (usually press Start Call)" : "Receiver"}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Only one side should start to avoid offer glare.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={startCall} disabled={!canStart} style={buttonStyle}>
            Start Call
          </button>
          <button onClick={endCall} disabled={!callActive} style={endButtonStyle}>
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
      <div style={{ marginTop: 16 }}>
        {/* {lines.map((l, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div><b>Transcript:</b> {l.transcript}</div>
            {l.en ? <div><b>EN:</b> {l.en}</div> : null}
          </div>
        ))} */}
        {/* {lines.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div><b>Transcript:</b> {lines[lines.length - 1].transcript}</div>
            {lines[lines.length - 1].en && (
              <div><b>EN:</b> {lines[lines.length - 1].en}</div>
            )}
          </div>
        )} */}
      </div>
    </div>
  );
}
