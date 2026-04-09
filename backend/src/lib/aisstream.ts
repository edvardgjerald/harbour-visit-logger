import WebSocket from "ws";
import { AISMessageSchema } from "@vessel/shared";
import type { AISMessage } from "@vessel/shared";
import { config } from "../config.js";
import { logger } from "./logger.js";

type OnMessageCallback = (message: AISMessage) => void;
type OnStatusChangeCallback = (
  status: "connecting" | "connected" | "disconnected"
) => void;

/**
 * Manages the upstream WebSocket connection to AISStream.io.
 * Handles authentication, message parsing via Zod, and automatic
 * reconnection with exponential backoff on disconnects.
 */
export class AISStreamClient {
  public status: "connecting" | "connected" | "disconnected" = "disconnected";
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;
  private onMessage: OnMessageCallback;
  private onStatusChange?: OnStatusChangeCallback;
  private validCount = 0;
  private dropCount = 0;

  constructor(onMessage: OnMessageCallback, onStatusChange?: OnStatusChangeCallback) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  private setStatus(newStatus: "connecting" | "connected" | "disconnected") {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.onStatusChange?.(newStatus);
    }
  }

  /** Opens the upstream WebSocket connection. No-ops if the API key is missing. */
  connect(): void {
    if (!config.aisstream.apiKey) {
      logger.warn(
        "AISSTREAM_API_KEY not set — skipping upstream connection. " +
          "Set it in .env to receive live AIS data."
      );
      this.setStatus("disconnected");
      return;
    }

    this.isShuttingDown = false;
    this.doConnect();
  }

  private doConnect(): void {
    logger.info({ url: config.aisstream.url }, "Connecting to AISStream...");
    this.setStatus("connecting");

    this.ws = new WebSocket(config.aisstream.url);

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");
      logger.info("AISStream connection established");

      const subscription = {
        Apikey: config.aisstream.apiKey,
        BoundingBoxes: config.aisstream.boundingBox,
        FilterMessageTypes: [
          "PositionReport",
          "StandardClassBPositionReport",
          "ExtendedClassBPositionReport",
        ],
      };

      this.ws?.send(JSON.stringify(subscription));
      logger.info({ boundingBox: config.aisstream.boundingBox }, "Subscription sent");
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const raw = JSON.parse(data.toString());

        // Handle AISStream native errors specifically
        if (raw && typeof raw === "object" && "error" in raw) {
          logger.error({ error: raw.error }, "AISStream API Error");
          return;
        }

        const result = AISMessageSchema.safeParse(raw);

        if (result.success) {
          this.validCount++;
          this.onMessage(result.data);
        } else {
          this.dropCount++;
          // Always log the very first drop to see the actual structure, then throttle
          if (this.dropCount % 100 === 1) {
            logger.warn(
              {
                errors: result.error.issues.slice(0, 3),
                dropCount: this.dropCount,
                validCount: this.validCount,
                rawPayload: raw, // explicitly log the raw object
              },
              "Dropped malformed AIS message"
            );
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed to parse AISStream JSON");
      }
    });

    this.ws.on("close", (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, "AISStream connection closed");
      this.setStatus("disconnected");

      // 1008 = Policy Violation (usually invalid API key / unauthenticated)
      // 4xxx = Application-level client errors
      if (code === 1008 || (code >= 4000 && code < 5000)) {
        logger.fatal(
          { code, reason: reason.toString() },
          "❌ Fatal Error: AISStream connection rejected (Policy Violation or Client Error). Ensure your AISSTREAM_API_KEY is valid and active."
        );
        process.exit(1);
      }

      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      logger.error({ err: err.message }, "AISStream WebSocket error");
    });
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    const delay = Math.min(
      config.aisstream.reconnectBaseMs * Math.pow(2, this.reconnectAttempts),
      config.aisstream.reconnectMaxMs
    );

    this.reconnectAttempts++;
    logger.info(
      { attempt: this.reconnectAttempts, delayMs: delay },
      "Scheduling AISStream reconnect"
    );

    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  /** Gracefully closes the WebSocket with a 1-second force-terminate fallback. */
  disconnect(): Promise<void> {
    this.isShuttingDown = true;
    this.setStatus("disconnected");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    return new Promise((resolve) => {
      logger.info(
        { validTotal: this.validCount, droppedTotal: this.dropCount },
        "AISStream client disconnecting..."
      );

      if (!this.ws) {
        resolve();
        return;
      }

      // If already fully closed or closing
      if (this.ws.readyState === WebSocket.CLOSED) {
        this.ws = null;
        resolve();
        return;
      }

      // Hook onto the close event for graceful tear-down
      this.ws.once("close", () => {
        this.ws = null;
        resolve();
      });

      // Issue the termination hand-shake
      this.ws.close();

      // Fallback: If the server doesn't respond to the close frame quickly, forcefully terminate
      setTimeout(() => {
        if (this.ws) {
          this.ws.terminate();
          this.ws = null;
        }
        resolve();
      }, 1000);
    });
  }

  get isConnected(): boolean {
    return this.status === "connected";
  }
}
