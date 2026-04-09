import type { HarbourVisit } from "./visit.js";

// WebSocket Message Types
// Server → Client protocol between backend WS server and frontend clients.

/** Live vessel position broadcast. Sent for every AIS position report received. */
export interface VesselUpdateMessage {
  type: "vessel_update";
  payload: VesselPosition;
}

/** Vessel position data included in a `vessel_update` message. */
export interface VesselPosition {
  mmsi: number;
  shipName: string;
  latitude: number;
  longitude: number;
  cog: number | null;
  sog: number | null;
  heading: number | null;
  timestamp: string;
  /** Set when the vessel is currently inside a harbour zone, null otherwise. */
  activeZoneId: string | null;
  activeZoneName: string | null;
}

/** Fired once when a vessel first enters a harbour zone during a visit. */
export interface VisitAlertMessage {
  type: "visit_alert";
  payload: Omit<HarbourVisit, "id">;
}

/** Current AISStream connection health and connected client count. */
export interface ConnectionStatusMessage {
  type: "connection_status";
  payload: {
    aisstream: "connected" | "disconnected" | "connecting" | "error";
    clientCount: number;
  };
}

/** Periodic keep-alive sent to all connected frontend clients. */
export interface HeartbeatMessage {
  type: "heartbeat";
  payload: {
    serverTime: string;
    uptime: number;
  };
}

/** Discriminated union of all server→client WebSocket messages. */
export type ServerMessage =
  | VesselUpdateMessage
  | VisitAlertMessage
  | ConnectionStatusMessage
  | HeartbeatMessage;
