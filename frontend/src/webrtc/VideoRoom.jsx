import { useCallback, useEffect, useRef } from "react";
import { useSignaling } from "./signaling";

const pcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoRoom({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const onSignalMessage = useCallback(async (msg) => {
    const pc = pcRef.current;
    if (!pc) return;

    if (msg.type === "offer") {
      await pc.setRemoteDescription(msg.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", roomId, sdp: pc.localDescription });
    }

    if (msg.type === "answer") {
      await pc.setRemoteDescription(msg.sdp);
    }

    if (msg.type === "ice") {
      try {
        await pc.addIceCandidate(msg.candidate);
      } catch (e) {
        console.warn("addIceCandidate failed", e);
      }
    }
  }, [roomId]);

  const { send } = useSignaling(roomId, onSignalMessage);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (cancelled) return;

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(pcConfig);
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: "ice", roomId, candidate: e.candidate });
      };

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    }

    init();

    return () => {
      cancelled = true;
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, send]);

  const startCall = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", roomId, sdp: pc.localDescription });
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 800 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "50%" }} />
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "50%" }} />
      </div>

      <button onClick={startCall}>Start Call</button>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Open this same room on a second device/tab and click “Start Call” on one side.
      </div>
    </div>
  );
}
