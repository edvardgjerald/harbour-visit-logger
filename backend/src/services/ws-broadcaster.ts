import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { ServerMessage } from "@vessel/shared";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

/**
 * Manages WebSocket connections to frontend clients.
 */
export class WSBroadcaster {
  private wss: WebSocketServer;
  private getAisStatus: () => "connected" | "disconnected" | "connecting";
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();
  private vesselCache = new Map<number, ServerMessage>();

  constructor(
    wss: WebSocketServer,
    getAisStatus: () => "connected" | "disconnected" | "connecting"
  ) {
    this.wss = wss;
    this.getAisStatus = getAisStatus;
    this.setupConnectionHandler();
    this.startHeartbeat();
  }

  private setupConnectionHandler(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const clientIp = req.socket.remoteAddress || "unknown";
      logger.info({ clientIp, clientCount: this.clientCount }, "Client connected");

      // Send immediate connection status to newly connected client
      ws.send(
        JSON.stringify({
          type: "connection_status",
          payload: {
            aisstream: this.getAisStatus(),
            clientCount: this.clientCount,
          },
        })
      );

      // Hydrate client with current known vessel state
      for (const msg of this.vesselCache.values()) {
        ws.send(JSON.stringify(msg));
      }

      ws.on("close", () => {
        logger.info({ clientIp, clientCount: this.clientCount }, "Client disconnected");
      });

      ws.on("error", (err) => {
        logger.error({ err: err.message, clientIp }, "Client WS error");
      });
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({
        type: "heartbeat",
        payload: {
          serverTime: new Date().toISOString(),
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
        },
      });
    }, config.ws.heartbeatIntervalMs);
  }

  /**
   * Sends a message to all connected frontend clients.
   * Vessel updates are cached in-memory to hydrate newly connecting clients.
   */
  broadcast(message: ServerMessage): void {
    if (message.type === "vessel_update") {
      this.vesselCache.set(message.payload.mmsi, message);
      if (this.vesselCache.size > 300) {
        // Keep memory bounded
        const oldest = this.vesselCache.keys().next().value;
        if (oldest !== undefined) this.vesselCache.delete(oldest);
      }
    }

    const data = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, (err) => {
          if (err) logger.error({ err: err.message }, "Send to client failed");
        });
      }
    });
  }

  /** Number of currently connected WebSocket clients. */
  get clientCount(): number {
    return this.wss.clients.size;
  }

  /** Stops the heartbeat timer and closes all client connections. */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.wss.clients.forEach((client) => client.close());
    this.wss.close();
    logger.info("WebSocket broadcaster stopped");
  }
}
