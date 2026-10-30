import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Security Hardening: Disable x-powered-by banner
  app.disable("x-powered-by");

  // Security Hardening: Standard HTTP Security Headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // WebSocket Server for Signaling with payload limits
  const wss = new WebSocketServer({ 
    server,
    maxPayload: 8 * 1024 * 1024 // 8MB maximum frame size to guard against memory exhaustion
  });

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
        // Prevent parsing excessively huge text payloads
        if (text.length > 512 * 1024) return;
        const data = JSON.parse(text);
        const { type, room, payload } = data;
        const cleanRoom = typeof room === "string" ? room.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : null;

        if (type === "join") {
          if (!cleanRoom) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid room identifier." }));
            return;
          }
          currentRoom = cleanRoom;
          if (!rooms.has(cleanRoom)) {
            rooms.set(cleanRoom, new Set());
          }
          
          const roomClients = rooms.get(cleanRoom)!;

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
          const targetRoom = cleanRoom || currentRoom;
          if (targetRoom && rooms.has(targetRoom)) {
            rooms.get(targetRoom)!.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "signal", payload }));
              }
            });
          }
        } else if (type === "relay-data") {
          // High-speed relay for application data, control messages, and file metadata
          const targetRoom = cleanRoom || currentRoom;
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
    const { roomId, ssid } = req.body || {};
    const cleanRoomId = typeof roomId === "string" ? roomId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : "";
    if (!cleanRoomId) {
      return res.status(400).json({ error: "Valid roomId is required (alphanumeric, max 32 chars)" });
    }

    const cleanSsid = typeof ssid === "string" 
      ? ssid.trim().replace(/[^\w\s-]/gi, "").slice(0, 48)
      : `FastShare-Direct-${cleanRoomId}`;

    activeHotspotSignal = {
      roomId: cleanRoomId,
      ssid: cleanSsid,
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
    const ip = String(rawIp).split(',')[0].trim().slice(0, 64);
    res.json({ isInstalled: installedIps.has(ip), ip });
  });

  app.post("/api/mark-installed", (req, res) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = String(rawIp).split(',')[0].trim().slice(0, 64);
    if (ip) {
      // Memory protection: limit set size to 1,000 entries
      if (installedIps.size >= 1000) {
        const first = installedIps.values().next().value;
        if (first) installedIps.delete(first);
      }
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
