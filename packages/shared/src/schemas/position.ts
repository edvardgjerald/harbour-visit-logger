import { z } from "zod";

/**
 * Metadata envelope from AISStream, containing vessel identity and position context.
 * @see https://aisstream.io/documentation
 */
export const MetaDataSchema = z.object({
  MMSI: z.int(),
  MMSI_String: z.coerce.string().optional(),
  ShipName: z.string().default("Unknown"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  time_utc: z.string(),
});

/**
 * AIS Position Report fields. Most fields are optional since different
 * message types (Class A, Standard/Extended Class B) include varying subsets.
 */
export const PositionReportSchema = z.object({
  Cog: z.optional(z.number()),
  CommunicationState: z.optional(z.number()),
  Latitude: z.number().min(-90).max(90),
  Longitude: z.number().min(-180).max(180),
  MessageID: z.optional(z.number()),
  NavigationalStatus: z.optional(z.number()),
  PositionAccuracy: z.optional(z.boolean()),
  Raim: z.optional(z.boolean()),
  RateOfTurn: z.optional(z.number()),
  RepeatIndicator: z.optional(z.number()),
  Sog: z.optional(z.number()),
  Spare: z.optional(z.number()),
  SpecialManoeuvreIndicator: z.optional(z.number()),
  Timestamp: z.optional(z.number()),
  TrueHeading: z.optional(z.number()),
  UserID: z.optional(z.number()),
  Valid: z.optional(z.boolean()),
});

/**
 * Top-level AIS message from the AISStream WebSocket.
 *
 * The raw payload nests the position report under a dynamic key matching
 * the `MessageType` (e.g., `PositionReport`, `StandardClassBPositionReport`).
 * The transform normalises this into a consistent `Message.PositionReport` shape.
 */
export const AISMessageSchema = z
  .object({
    MessageType: z.enum([
      "PositionReport",
      "StandardClassBPositionReport",
      "ExtendedClassBPositionReport",
    ]),
    MetaData: MetaDataSchema,
    Message: z.record(z.string(), PositionReportSchema),
  })
  .transform((val) => {
    return {
      MessageType: "PositionReport" as const,
      MetaData: val.MetaData,
      Message: {
        PositionReport: val.Message[val.MessageType] as z.infer<
          typeof PositionReportSchema
        >,
      },
    };
  });

// Inferred Types

export type MetaData = z.infer<typeof MetaDataSchema>;
export type PositionReport = z.infer<typeof PositionReportSchema>;
export type AISMessage = z.infer<typeof AISMessageSchema>;
