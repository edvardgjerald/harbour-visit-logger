/** A single harbour visit record as returned by the REST API. */
export interface HarbourVisit {
  id: string;
  mmsi: number;
  vesselName: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  zoneId: string;
  zoneName: string | null;
  timestamp: string | Date;
}

/** Paginated response from `GET /api/visits`. */
export interface VisitListResponse {
  visits: HarbourVisit[];
  total: number;
  page: number;
  pageSize: number;
}
