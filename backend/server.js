const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 8080 });

// roomId -> Set of sockets
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const { type, roomId } = msg;
    if (!roomId) return;

    if (type === "join") {
      ws.roomId = roomId;
      getRoom(roomId).add(ws);

      // tell this client whether they are 1st or 2nd person
      const size = getRoom(roomId).size;
      ws.send(JSON.stringify({ type: "joined", roomId, isInitiator: size === 1 }));
      return;
    }

    // relay to everyone else in the room
    const room = getRoom(roomId);
    room.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(msg));
      }
    });
  });

  ws.on("close", () => {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.delete(ws);
    if (room.size === 0) rooms.delete(ws.roomId);
  });
});

console.log("Signaling server running on ws://localhost:8080");
