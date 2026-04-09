import type { Coordinate } from "../schemas/zone.js";

/**
 * Statically defined harbour zones used for geofence detection.
 * Each zone is a closed polygon (first and last coordinates must match).
 */
export const HARBOUR_ZONES: Array<{
  id: string;
  name: string;
  polygon: Coordinate[];
}> = [
  {
    id: "oslofjord-inner-harbour",
    name: "Oslofjord Inner Harbour",
    polygon: [
      [59.92, 10.45],
      [59.92, 10.8],
      [59.75, 10.8],
      [59.75, 10.45],
      [59.92, 10.45],
    ],
  },
];
