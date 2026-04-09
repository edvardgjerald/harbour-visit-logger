import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import type { AISMessage } from "@vessel/shared";
import { HARBOUR_ZONES } from "@vessel/shared";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { getPrisma, disconnectPrisma } from "./lib/db.js";
import { AISStreamClient } from "./lib/aisstream.js";
import { findActiveHarbourZone } from "./lib/geofence.js";
import { VisitBatcher } from "./lib/visit-batcher.js";
import { WSBroadcaster } from "./services/ws-broadcaster.js";
import { createApiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize

const prisma = getPrisma();
const app = express();

app.use(express.json());

// REST API
app.use("/api", createApiRouter(prisma));

// Serve frontend static files (Vite build output)
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// SPA fallback: serve index.html for all non-API, non-WS routes
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
    return next();
  }
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      // Frontend not built yet — helpful dev message
      res.status(503).json({
        error: "Frontend not built",
        hint: "Run `npm run build -w frontend` or use `npm run dev` for development",
      });
    }
  });
});

// HTTP server
const server = createServer(app);

// Forward declare aisClient so broadcaster can read its status
let aisClient: AISStreamClient | undefined = undefined;

// WebSocket server for frontend clients (same port, different path)
const wss = new WebSocketServer({ server, path: config.ws.path });
const broadcaster = new WSBroadcaster(wss, () => aisClient?.status ?? "disconnected");

// Visit batcher
const visitBatcher = new VisitBatcher(prisma);
visitBatcher.start();

/** Tracks MMSIs currently inside a zone so `visit_alert` is only sent once per visit. */
const activeHarbourVessels = new Set<number>();

// AISStream → Geofence Check → Broadcast

/**
 * Core message handler: checks geofence membership, broadcasts vessel
 * positions to all frontend clients, and queues visit records for persistence.
 */
function handleAISMessage(message: AISMessage): void {
  const { MetaData, Message } = message;
  const { PositionReport: pos } = Message;

  // Check geofence visits
  const activeZone = findActiveHarbourZone(pos.Latitude, pos.Longitude, HARBOUR_ZONES);

  // Broadcast vessel update with active zone context
  broadcaster.broadcast({
    type: "vessel_update",
    payload: {
      mmsi: MetaData.MMSI,
      shipName: MetaData.ShipName,
      latitude: pos.Latitude,
      longitude: pos.Longitude,
      cog: pos.Cog ?? null,
      sog: pos.Sog ?? null,
      heading: pos.TrueHeading ?? null,
      timestamp: MetaData.time_utc,
      activeZoneId: activeZone ? activeZone.id : null,
      activeZoneName: activeZone ? activeZone.name : null,
    },
  });

  if (activeZone) {
    logger.debug(
      {
        mmsi: MetaData.MMSI,
        vessel: MetaData.ShipName,
        zone: activeZone.name,
        lat: pos.Latitude,
        lng: pos.Longitude,
      },
      "⚓ Harbour Visit"
    );

    visitBatcher.add({
      mmsi: MetaData.MMSI,
      vesselName: MetaData.ShipName || null,
      latitude: pos.Latitude,
      longitude: pos.Longitude,
      speed: pos.Sog ?? null,
      heading: pos.TrueHeading ?? null,
      zoneId: activeZone.id,
    });

    if (!activeHarbourVessels.has(MetaData.MMSI)) {
      activeHarbourVessels.add(MetaData.MMSI);

      broadcaster.broadcast({
        type: "visit_alert",
        payload: {
          mmsi: MetaData.MMSI,
          vesselName: MetaData.ShipName || null,
          latitude: pos.Latitude,
          longitude: pos.Longitude,
          speed: pos.Sog ?? null,
          heading: pos.TrueHeading ?? null,
          zoneId: activeZone.id,
          zoneName: activeZone.name,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } else {
    activeHarbourVessels.delete(MetaData.MMSI);
  }
}

// Start

aisClient = new AISStreamClient(handleAISMessage, (status) => {
  broadcaster.broadcast({
    type: "connection_status",
    payload: { aisstream: status, clientCount: broadcaster.clientCount },
  });
});

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    server.listen(config.port, () => {
      logger.info(
        { port: config.port, wsPath: config.ws.path },
        `🚢 Vessel Harbour Logger running on port ${config.port}`
      );
    });

    // Delay connecting to AISStream by 2 seconds to allow any lingering
    // tsx watch triggers (from parallel monorepo builds) to safely restart
    // the server without burning an API connection and triggering rate-limits.
    setTimeout(() => {
      aisClient!.connect();
    }, 2000);
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

// Graceful Shutdown

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down...");

  // Properly await the TLS/WebSocket disconnect handshake!
  await aisClient!.disconnect();

  visitBatcher.stop();
  broadcaster.stop();

  server.close(() => logger.info("HTTP server closed"));

  await disconnectPrisma();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
