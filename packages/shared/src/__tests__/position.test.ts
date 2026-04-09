import { describe, it, expect } from "vitest";
import { AISMessageSchema } from "../schemas/position.js";

const TEST_MMSI = 123456789;

/** Minimal valid MetaData envelope reusable across tests. */
function makeMetaData(overrides: Record<string, unknown> = {}) {
  return {
    MMSI: TEST_MMSI,
    MMSI_String: TEST_MMSI.toString(),
    ShipName: "TEST VESSEL",
    latitude: 59.9,
    longitude: 10.7,
    time_utc: "2024-03-20 14:00:00.000000000 UTC",
    ...overrides,
  };
}

describe("AISMessageSchema", () => {
  describe("Class A — PositionReport", () => {
    it("parses a full Class A message and preserves all fields", () => {
      const raw = {
        MessageType: "PositionReport",
        MetaData: makeMetaData(),
        Message: {
          PositionReport: {
            Latitude: 59.9,
            Longitude: 10.7,
            Cog: 120,
            Sog: 12.5,
            TrueHeading: 125,
          },
        },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.MessageType).toBe("PositionReport");
      expect(result.data.MetaData.MMSI).toBe(TEST_MMSI);
      expect(result.data.Message.PositionReport.Latitude).toBe(59.9);
      expect(result.data.Message.PositionReport.Cog).toBe(120);
      expect(result.data.Message.PositionReport.Sog).toBe(12.5);
    });
  });

  describe("Class B — StandardClassBPositionReport", () => {
    it("normalises into Message.PositionReport", () => {
      const raw = {
        MessageType: "StandardClassBPositionReport",
        MetaData: makeMetaData({ MMSI: 987654321 }),
        Message: {
          StandardClassBPositionReport: {
            Latitude: 59.8,
            Longitude: 10.6,
            Cog: 45,
            Sog: 5.5,
            TrueHeading: 51,
          },
        },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Transform must rewrite MessageType
      expect(result.data.MessageType).toBe("PositionReport");
      // Transform must lift payload into .Message.PositionReport
      expect(result.data.Message.PositionReport).toBeDefined();
      expect(result.data.Message.PositionReport.Latitude).toBe(59.8);
      expect(result.data.Message.PositionReport.Sog).toBe(5.5);
    });
  });

  describe("Class B — ExtendedClassBPositionReport", () => {
    it("normalises into Message.PositionReport", () => {
      const raw = {
        MessageType: "ExtendedClassBPositionReport",
        MetaData: makeMetaData({ MMSI: 111222333 }),
        Message: {
          ExtendedClassBPositionReport: {
            Latitude: 59.7,
            Longitude: 10.5,
            Cog: 90,
            Sog: 3.2,
            TrueHeading: 88,
          },
        },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.MessageType).toBe("PositionReport");
      expect(result.data.Message.PositionReport.Latitude).toBe(59.7);
      expect(result.data.Message.PositionReport.Sog).toBe(3.2);
    });
  });

  describe("Optional fields", () => {
    it("accepts a message with only the required Latitude and Longitude", () => {
      const raw = {
        MessageType: "PositionReport",
        MetaData: makeMetaData(),
        Message: {
          PositionReport: {
            Latitude: 59.9,
            Longitude: 10.7,
          },
        },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.Message.PositionReport.Sog).toBeUndefined();
      expect(result.data.Message.PositionReport.Cog).toBeUndefined();
    });
  });

  describe("Rejection cases", () => {
    it("rejects an unknown message type", () => {
      const raw = {
        MessageType: "SomeNewAISType",
        MetaData: makeMetaData(),
        Message: { SomeNewAISType: { Latitude: 0, Longitude: 0 } },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });

    it("rejects coordinates outside valid range", () => {
      const raw = {
        MessageType: "PositionReport",
        MetaData: makeMetaData({ latitude: 999, longitude: 999 }),
        Message: {
          PositionReport: { Latitude: 999, Longitude: 999 },
        },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });

    it("rejects when MetaData is missing required fields", () => {
      const raw = {
        MessageType: "PositionReport",
        MetaData: { MMSI: 123 }, // missing latitude, longitude, time_utc
        Message: {
          PositionReport: { Latitude: 59.9, Longitude: 10.7 },
        },
      };

      const result = AISMessageSchema.safeParse(raw);
      expect(result.success).toBe(false);
    });
  });
});
