import type { Coordinate } from "@vessel/shared";

/**
 * Determines whether a point lies inside a polygon using the ray-casting algorithm.
 * @see https://en.wikipedia.org/wiki/Point_in_polygon#Ray_casting_algorithm
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Coordinate[]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Finds the first harbour zone that contains the given coordinates.
 * @returns The matching zone's `id` and `name`, or `null` if outside all zones.
 */
export function findActiveHarbourZone(
  lat: number,
  lng: number,
  zones: Array<{ id: string; name: string; polygon: Coordinate[] }>
): { id: string; name: string } | null {
  for (const zone of zones) {
    if (isPointInPolygon(lat, lng, zone.polygon)) {
      return { id: zone.id, name: zone.name };
    }
  }
  return null;
}
