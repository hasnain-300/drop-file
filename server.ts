import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // WebSocket Server for Signaling
  const wss = new WebSocketServer({ server });

  const rooms = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws) => {
    let currentRoom: string | null = null;

    ws.on("message", (message, isBinary) => {
      // 1. Relay binary data directly (e.g., file chunks during fallback relay)
      if (isBinary) {
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom)!.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(message, { binary: true });
            }
          });
        }
        return;
      }

      // 2. Text JSON messages
      try {
        const text = message.toString();
        const data = JSON.parse(text);
        const { type, room, payload } = data;

        if (type === "join") {
          currentRoom = room;
          if (!rooms.has(room)) {
            rooms.set(room, new Set());
          }
          
          const roomClients = rooms.get(room)!;

          // Cleanup any dead/closed sockets first
          for (const client of roomClients) {
            if (client.readyState !== WebSocket.OPEN) {
              roomClients.delete(client);
            }
          }

          // If this socket was already in room, avoid duplicate
          roomClients.add(ws);

          // Prevent more than 2 active peers in a room
          if (roomClients.size > 2) {
            ws.send(JSON.stringify({ type: "error", message: "Room is full. Please try a different code." }));
            roomClients.delete(ws);
            return;
          }
          
          // Notify other peer in the room
          roomClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "peer-joined" }));
            }
          });

          // Also notify joining peer if partner is already present
          if (roomClients.size > 1) {
            ws.send(JSON.stringify({ type: "peer-joined" }));
          }
        } else if (type === "ws-ping") {
          ws.send(JSON.stringify({ type: "ws-pong" }));
        } else if (type === "signal") {
          // Broadcast WebRTC signaling (offer/answer/ice)
          const targetRoom = room || currentRoom;
          if (targetRoom && rooms.has(targetRoom)) {
            rooms.get(targetRoom)!.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "signal", payload }));
              }
            });
          }
        } else if (type === "relay-data") {
          // High-speed relay for application data, control messages, and file metadata
          const targetRoom = room || currentRoom;
          if (targetRoom && rooms.has(targetRoom)) {
            rooms.get(targetRoom)!.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "relay-data", payload }));
              }
            });
          }
        } else if (type === "leave") {
          if (currentRoom && rooms.has(currentRoom)) {
            const roomClients = rooms.get(currentRoom)!;
            roomClients.delete(ws);
            if (roomClients.size === 0) {
              rooms.delete(currentRoom);
            } else {
              roomClients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ type: "peer-left" }));
                }
              });
            }
            currentRoom = null;
          }
        }
      } catch (err) {
        console.error("WS message error", err);
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const roomClients = rooms.get(currentRoom)!;
        roomClients.delete(ws);
        if (roomClients.size === 0) {
          rooms.delete(currentRoom);
        } else {
          roomClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "peer-left" }));
            }
          });
        }
      }
    });
  });

  app.use(express.json());

  const installedIps = new Set<string>();

  interface HotspotSignal {
    roomId: string;
    ssid: string;
    timestamp: number;
  }
  let activeHotspotSignal: HotspotSignal | null = null;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/hotspot/active", (req, res) => {
    // If signal is older than 2 hours, auto-expire
    if (activeHotspotSignal && Date.now() - activeHotspotSignal.timestamp > 2 * 60 * 60 * 1000) {
      activeHotspotSignal = null;
    }
    res.json({ active: !!activeHotspotSignal, signal: activeHotspotSignal });
  });

  app.post("/api/hotspot/broadcast", (req, res) => {
    const { roomId, ssid } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }
    activeHotspotSignal = {
      roomId,
      ssid: ssid || `FastShare-Direct-${roomId}`,
      timestamp: Date.now(),
    };
    
    // Notify all connected clients via WebSocket
    const broadcastMsg = JSON.stringify({
      type: "hotspot-signal-broadcast",
      signal: activeHotspotSignal,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(broadcastMsg);
      }
    });

    res.json({ success: true, signal: activeHotspotSignal });
  });

  app.post("/api/hotspot/stop", (req, res) => {
    activeHotspotSignal = null;
    const stopMsg = JSON.stringify({ type: "hotspot-signal-stopped" });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(stopMsg);
      }
    });
    res.json({ success: true });
  });

  app.get("/api/installation-status", (req, res) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = String(rawIp).split(',')[0].trim();
    res.json({ isInstalled: installedIps.has(ip), ip });
  });

  app.post("/api/mark-installed", (req, res) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = String(rawIp).split(',')[0].trim();
    if (ip) {
      installedIps.add(ip);
    }
    res.json({ success: true, ip });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
