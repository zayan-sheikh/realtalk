import { useEffect, useRef, useState } from "react";

const PC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Production: add TURN here for reliability
  ],
};

export default function VideoRoom({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState("Starting...");
  const [isInitiator, setIsInitiator] = useState(false);

  // IMPORTANT: if testing on phone/other laptop, "localhost" won't work.
  // Use your dev machine LAN IP like ws://192.168.1.42:8080
  const SIGNAL_URL = "ws://localhost:8080";

  useEffect(() => {
    let cancelled = false;

    console.log("CLIENT joining room:", roomId);


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

      // Create PeerConnection now (before messages arrive)
      const pc = new RTCPeerConnection(PC_CONFIG);
      pcRef.current = pc;

      // Send local tracks to peer
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      // When remote tracks arrive, show them
      pc.ontrack = (e) => {
        remoteVideoRef.current.srcObject = e.streams[0];
      };

      // Send ICE candidates to the other peer via WebSocket
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
      try { wsRef.current?.close(); } catch {}
      try { pcRef.current?.close(); } catch {}
      try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    };
  }, [roomId]);

  // Only ONE side should press "Start Call" to avoid offer glare
  const startCall = async () => {
    const ws = wsRef.current;
    const pc = pcRef.current;
    if (!ws || !pc) return;

    setStatus("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", roomId, sdp: pc.localDescription }));
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      <div style={{ fontSize: 14, opacity: 0.8 }}>
        <b>Status:</b> {status} <br />
        <b>Role:</b> {isInitiator ? "Initiator (usually press Start Call)" : "Receiver"}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Local</div>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Remote</div>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%" }} />
        </div>
      </div>

      <button onClick={startCall} disabled={!isInitiator}>
        Start Call (only one side)
      </button>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Open the same roomId on a second device/tab. If the second device is not the same machine,
        change SIGNAL_URL from localhost to your laptop’s LAN IP.
      </div>
    </div>
  );
}
