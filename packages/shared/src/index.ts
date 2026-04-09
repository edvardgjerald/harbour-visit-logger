// Schemas (runtime validation)
export {
  MetaDataSchema,
  PositionReportSchema,
  AISMessageSchema,
} from "./schemas/position.js";

export { CoordinateSchema } from "./schemas/zone.js";

export { HARBOUR_ZONES } from "./config/zones.js";

// Types
export type { MetaData, PositionReport, AISMessage } from "./schemas/position.js";

export type { Coordinate } from "./schemas/zone.js";

export type { HarbourVisit, VisitListResponse } from "./schemas/visit.js";

export type {
  VesselUpdateMessage,
  VisitAlertMessage,
  ConnectionStatusMessage,
  HeartbeatMessage,
  ServerMessage,
  VesselPosition,
} from "./schemas/ws.js";
