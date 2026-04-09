import { describe, it, expect } from "vitest";
import { isPointInPolygon, findActiveHarbourZone } from "../lib/geofence.js";
import { HARBOUR_ZONES } from "@vessel/shared";

describe("isPointInPolygon", () => {
  // Intentionally non-square so a lat/lng swap would produce wrong results
  const rectangle: [number, number][] = [
    [0, 0],
    [0, 20],
    [10, 20],
    [10, 0],
    [0, 0],
  ];

  it("returns true for a point inside the polygon", () => {
    expect(isPointInPolygon(5, 10, rectangle)).toBe(true);
  });

  it("returns false for a point outside the polygon", () => {
    expect(isPointInPolygon(15, 10, rectangle)).toBe(false);
  });

  it("detects axis confusion — point inside lat range but outside lng range", () => {
    // lat=5 is within [0,10], but lng=25 is outside [0,20]
    expect(isPointInPolygon(5, 25, rectangle)).toBe(false);
  });

  it("detects axis confusion — point inside lng range but outside lat range", () => {
    // lng=10 is within [0,20], but lat=12 is outside [0,10]
    expect(isPointInPolygon(12, 10, rectangle)).toBe(false);
  });

  // Concave L-shaped polygon:
  //   (0,0)──(0,10)
  //     │        │
  //   (5,0)──(5,5)
  //             │
  //          (10,5)──(10,10)
  //                    │
  //                  (0,10) ... wait, let me draw this properly.
  //
  // An L-shape that covers the top half fully and the right half of the bottom:
  //
  //  (0,0)───────(0,10)
  //    │            │
  //  (5,0)─(5,5) (5,10)
  //          │      │
  //        (10,5)─(10,10)
  //
  const lShape: [number, number][] = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 5],
    [5, 5],
    [5, 0],
    [0, 0],
  ];

  it("handles concave polygons — point in top-left arm", () => {
    expect(isPointInPolygon(2, 2, lShape)).toBe(true);
  });

  it("handles concave polygons — point in bottom-right arm", () => {
    expect(isPointInPolygon(7, 7, lShape)).toBe(true);
  });

  it("handles concave polygons — point in the concave cutout", () => {
    // (7, 2) is inside the bounding box but in the cut-out corner
    expect(isPointInPolygon(7, 2, lShape)).toBe(false);
  });
});

describe("findActiveHarbourZone — real Oslofjord zone", () => {
  it("detects a vessel in central Oslo harbour", () => {
    // Roughly Aker Brygge / Vippetangen area
    const result = findActiveHarbourZone(59.9, 10.7, HARBOUR_ZONES);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("oslofjord-inner-harbour");
  });

  it("detects a vessel near Nesodden ferry terminal", () => {
    // Inside the polygon near the southern edge
    const result = findActiveHarbourZone(59.86, 10.66, HARBOUR_ZONES);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("oslofjord-inner-harbour");
  });

  it("returns null for a vessel in the outer Oslofjord (south of zone)", () => {
    // Drøbak area — outside the polygon
    const result = findActiveHarbourZone(59.65, 10.63, HARBOUR_ZONES);
    expect(result).toBeNull();
  });

  it("returns null for a vessel in open sea", () => {
    const result = findActiveHarbourZone(58.0, 8.0, HARBOUR_ZONES);
    expect(result).toBeNull();
  });
});
