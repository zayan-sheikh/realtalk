import { useEffect, useRef } from "react";

export function useSignaling(roomId, onMessage) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join", roomId }));
    };

    socket.onmessage = (event) => onMessage(JSON.parse(event.data));

    socket.onerror = (e) => console.error("WebSocket error", e);
    socket.onclose = () => console.log("WebSocket closed");

    return () => socket.close();
  }, [roomId, onMessage]);

  const send = (data) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  return { send };
}
