import { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Use pure shared types and schemas to enforce type safety
import { HARBOUR_ZONES } from "@vessel/shared";
import type { VesselPosition } from "@vessel/shared";

/** Forces Leaflet to recalculate its layout after React rendering settles. */
function MapUpdater() {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
}

interface VesselMapProps {
  vessels: VesselPosition[];
}

/** Map marker icon for vessels with speed > 0.1 knots. */
const shipIconMoving = new L.DivIcon({
  html: '<div style="font-size: 24px; text-shadow: 0 0 5px rgba(255,255,255,0.8);">🚢</div>',
  className: "ship-icon",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Map marker icon for stationary or anchored vessels. */
const anchorIconStationary = new L.DivIcon({
  html: '<div style="font-size: 24px; text-shadow: 0 0 5px rgba(255,255,255,0.8);">⚓</div>',
  className: "ship-icon",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Interactive Leaflet map displaying harbour zone polygons and live vessel markers. */
export function VesselMap({ vessels }: VesselMapProps) {
  const zones = HARBOUR_ZONES; // Use local config instead of fetching API

  return (
    <div
      className="flex flex-col bg-gray-900/55 backdrop-blur-[20px] border border-slate-400/15 rounded-2xl shadow-lg shadow-black/40 overflow-hidden transition-colors hover:border-slate-400/25 min-h-[650px] h-full"
      id="vessel-map-card"
    >
      <div className="flex items-center justify-between py-[18px] px-6 border-b border-slate-400/10">
        <span className="text-[0.95rem] font-semibold flex items-center gap-[10px]">
          <span className="text-[1.1rem]">🗺️</span>
          Live Map
        </span>
      </div>

      {/* 
        The map-wrapper strictly buffers layout calculations. 
        It shields the internal MapContainer from dynamic grid flex collapses.
      */}
      <div className="relative w-full flex-1 rounded-b-[inherit] overflow-hidden">
        <MapContainer
          center={[59.8, 10.6]} // Shifted South to frame the new water geofence
          zoom={9}
          className="absolute inset-0 h-full w-full z-10" // Applied instead of relying purely on default .leaflet-container
        >
          <MapUpdater />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {zones.map((zone) => {
            // Guarantee we don't crash leaflet with bad point arrays
            if (!zone.polygon || zone.polygon.length < 3) return null;

            return (
              <Polygon
                key={zone.id}
                positions={zone.polygon}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.15,
                }}
              >
                <Popup>
                  <strong>{zone.name}</strong>
                  <br />
                  Harbour Zone
                </Popup>
              </Polygon>
            );
          })}

          {vessels.map((v) => {
            const isMoving = (v.sog ?? 0) > 0.1;
            const isAlert = !!v.activeZoneName;
            return (
              <Marker
                key={v.mmsi}
                position={[v.latitude, v.longitude]}
                icon={isMoving ? shipIconMoving : anchorIconStationary}
              >
                <Popup>
                  <strong>{v.shipName || "Unknown Vessel"}</strong>
                  <br />
                  <span className="text-[12px] opacity-70 border px-1 py-0.5 rounded border-gray-400 bg-[rgba(255,255,255,0.1)] block mt-1 mb-1">
                    MMSI: {v.mmsi}
                  </span>
                  Speed: {v.sog ? `${v.sog.toFixed(1)} kn` : "N/A"}
                  <br />
                  {isAlert ? (
                    <span style={{ color: "#3b82f6", fontWeight: "bold" }}>
                      ⚓ Visiting: {v.activeZoneName}
                    </span>
                  ) : null}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
