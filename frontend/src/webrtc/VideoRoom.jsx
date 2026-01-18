import { useEffect, useRef, useState } from "react";
import './VideoRoom.css';

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
  const [firstCallStarted, setFirstCallStarted] = useState(false);

  const SIGNAL_URL = "ws://35.183.199.110:8080";

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

        if (msg.type === "end") {
          setStatus("Call ended by peer");
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
          remoteVideoRef.current.srcObject = null;
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
  };

  const canStart = (!firstCallStarted && isInitiator && !callActive) || (firstCallStarted && !callActive);

  return (
    <div className="video-room-wrap">
      {/* Header */}
      <div className="video-room-header">
        <div className="video-room-title">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Video Room</div>
          <div className="video-room-pill">
            <span style={{ opacity: 0.7 }}>Room</span>
            <span style={{ fontWeight: 600 }}>{roomId}</span>
          </div>
        </div>

        <div className="video-room-status-pill" title={status}>
          <span className={`video-room-dot ${canStart ? 'can-start' : 'cannot-start'}`} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {status}
          </span>
        </div>
      </div>

      {/* Videos */}
      <div className="video-room-grid">
        <div className="video-room-card">
          <div className="video-room-card-header">
            <div className="video-room-label">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#3b82f6" }} />
              Local
            </div>
            <span className="video-room-badge">Muted</span>
          </div>
          <video ref={localVideoRef} autoPlay muted playsInline className="video-room-video" />
        </div>

        <div className="video-room-card">
          <div className="video-room-card-header">
            <div className="video-room-label">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#a855f7" }} />
              Remote
            </div>
            <span className="video-room-badge">Live</span>
          </div>
          <video ref={remoteVideoRef} autoPlay playsInline className="video-room-video" />
        </div>
      </div>

      {/* Controls */}
      <div className="video-room-controls">
        <div className="video-room-role-text">
          <div>
            <b>Role:</b>{" "}
            {isInitiator ? "Initiator (usually press Start Call)" : "Receiver"}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Only one side should start to avoid offer glare.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
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
            className={`video-room-end-button video-room-button ${callActive ? 'active' : 'inactive'}`}
          >
            End Call
          </button>
        </div>
      </div>

      {/* Helper */}
      {/* <div className="video-room-helper">
        Open the same <b>roomId</b> on a second device/tab. If the second device isn’t the same machine,
        change <b>SIGNAL_URL</b> from <b>localhost</b> to your laptop’s LAN IP.
      </div> */}
    </div>
  );
}
