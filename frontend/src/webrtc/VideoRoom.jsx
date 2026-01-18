import { useEffect, useRef, useState } from "react";

const PC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoRoom({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState("Starting...");
  const [isInitiator, setIsInitiator] = useState(false);
  const [callActive, setCallActive] = useState(false);

   const SIGNAL_URL = "ws://localhost:8080";

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

        if (msg.type === "offer") {
          setStatus("Received offer. Creating answer...");
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", roomId, sdp: pc.localDescription }));
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
        }
      };

      ws.onerror = () => setStatus("WebSocket error (check server / URL)");
      ws.onclose = () => setStatus("WebSocket closed");
    }

    start();

    return () => {
      cancelled = true;
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

    setStatus("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", roomId, sdp: pc.localDescription }));
    setCallActive(true);
  };

  const endCall = () => {
    setStatus("Call ended");
    setCallActive(false);
    try {
      pcRef.current?.getSenders().forEach((sender) => {
        try { sender.track?.stop(); } catch {}
      });
      pcRef.current?.close();
    } catch {}
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    // Optionally, notify peer (not implemented here)
  };

  const canStart = isInitiator && !callActive;

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
      <div style={helperStyle}>
        Open the same <b>roomId</b> on a second device/tab. If the second device isn’t the same machine,
        change <b>SIGNAL_URL</b> from <b>localhost</b> to your laptop’s LAN IP.
      </div>
    </div>
  );
}
