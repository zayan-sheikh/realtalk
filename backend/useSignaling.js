import { useEffect, useRef } from "react";

export function useSignaling(roomId, onMessage) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join", roomId }));
    };

    socket.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };

    return () => socket.close();
  }, [roomId]);

  const send = (data) => {
    socketRef.current?.send(JSON.stringify(data));
  };

  return { send };
}
