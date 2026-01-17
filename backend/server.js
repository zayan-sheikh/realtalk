import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // roomId -> Set<ws>

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    const { type, roomId } = data;

    if (type === "join") {
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(ws);
      ws.roomId = roomId;
      return;
    }

    // Relay signaling messages to the other peer
    if (["offer", "answer", "ice"].includes(type)) {
      rooms.get(roomId)?.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    }
  });

  ws.on("close", () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).delete(ws);
    }
  });
});

console.log("Signaling server running on ws://localhost:8080");
