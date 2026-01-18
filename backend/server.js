const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 8080 });

// roomId -> Set of sockets
const rooms = new Map();
// Track which clients are initiators
const initiators = new Set();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function hasActiveInitiator(room) {
  for (const client of room) {
    if (initiators.has(client) && client.readyState === 1) {
      return true;
    }
  }
  return false;
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const { type, roomId } = msg;
    if (!roomId) return;

    if (type === "join") {
      ws.roomId = roomId;
      const room = getRoom(roomId);
      
      // Clean up stale connections first
      const staleClients = [];
      room.forEach((client) => {
        if (client.readyState !== 1) {
          staleClients.push(client);
        }
      });
      staleClients.forEach((client) => {
        room.delete(client);
        initiators.delete(client);
      });
      
      room.add(ws);
      const size = room.size;

      // Determine if this client should be the initiator
      let isInitiator = false;
      if (size === 1) {
        // First person in room
        isInitiator = true;
      } else {
        // Check if there's already an active initiator
        if (!hasActiveInitiator(room)) {
          // No active initiator, this person should become the initiator
          isInitiator = true;
        }
      }

      if (isInitiator) {
        initiators.add(ws);
      }

      ws.send(JSON.stringify({ type: "joined", roomId, isInitiator }));
      return;
    }

    if (type === "offer") {
      // When someone sends an offer, mark them as initiator if not already
      if (!initiators.has(ws)) {
        initiators.add(ws);
      }
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
    initiators.delete(ws);
    if (room.size === 0) rooms.delete(ws.roomId);
  });
});

console.log("Signaling server running on ws://localhost:8080");
