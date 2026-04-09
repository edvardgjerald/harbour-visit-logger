import { z } from "zod";

/** A `[latitude, longitude]` coordinate pair with range validation. */
export const CoordinateSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
]);

export type Coordinate = z.infer<typeof CoordinateSchema>;
