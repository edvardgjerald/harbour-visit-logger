import { ErrorBoundary } from "react-error-boundary";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { VesselPosition, HarbourVisit, ServerMessage } from "@vessel/shared";
import { ErrorFallback } from "./components/ErrorBoundary";
import { VesselMap } from "./components/VesselMap";
import { VisitLog } from "./components/VisitLog";

/** WebSocket URL derived from the current page origin (works in both dev proxy and production). */
const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

/**
 * Root application component.
 * Owns the single WebSocket connection and all shared state
 * (vessel positions, harbour visits), passing data down to child components.
 */
export function App() {
  const [vessels, setVessels] = useState<Map<number, VesselPosition>>(new Map());
  const [visits, setVisits] = useState<HarbourVisit[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [isLoadingVisits, setIsLoadingVisits] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const fetchVisits = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoadingVisits(true);
    try {
      const res = await fetch("/api/visits?pageSize=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVisits(data.visits);
      setTotalVisits(data.total);
    } catch (err) {
      console.error("[App] Visit fetch failed:", err);
    } finally {
      setIsLoadingVisits(false);
    }
  }, []);

  // Fetch initial visits from REST API
  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);


  // Single WebSocket connection for all real-time data
  const connect = useCallback(function connectImpl() {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case "vessel_update":
            setVessels((prev) => {
              const next = new Map(prev);
              next.set(message.payload.mmsi, message.payload);
              if (next.size > 200) {
                const oldest = next.keys().next().value;
                if (oldest !== undefined) next.delete(oldest);
              }
              return next;
            });
            break;

          case "visit_alert":
            setVisits((prev) => {
              // Dedup: don't add if we already have this mmsi+zoneId
              if (
                prev.some(
                  (v) =>
                    v.mmsi === message.payload.mmsi && v.zoneId === message.payload.zoneId
                )
              ) {
                return prev;
              }
              setTotalVisits((t) => t + 1);
              const newVisit: HarbourVisit = {
                id: `rt-${Date.now()}`,
                ...message.payload,
              };
              return [newVisit, ...prev].slice(0, 50);
            });
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;
      reconnectTimer.current = setTimeout(connectImpl, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  // Resync when a sleeping tab becomes active again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Fetch visits that might have occurred while the tab was asleep
        fetchVisits(true);

        // Ensure the WebSocket is alive. If we lost connection, reconnect.
        if (wsRef.current?.readyState === WebSocket.CLOSED || !wsRef.current) {
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchVisits, connect]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const vesselList = useMemo(() => {
    return Array.from(vessels.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
  }, [vessels]);

  return (
    <div className="relative z-10 max-w-[1440px] mx-auto p-6 flex flex-col gap-6 min-h-screen">
      <header
        className="flex items-center justify-between py-5 px-7 bg-gray-900/55 backdrop-blur-[20px] border border-slate-400/15 rounded-2xl shadow-lg shadow-black/40"
        id="app-header"
      >
        <div className="flex items-center gap-[14px]">
          <span className="text-[28px] drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
            🚢
          </span>
          <div>
            <h1 className="text-[1.35rem] font-bold tracking-[-0.02em] bg-gradient-to-br from-slate-100 to-blue-500 text-transparent bg-clip-text">
              Vessel Harbour Log
            </h1>
            <p className="text-[0.8rem] text-slate-500">
              Oslofjord Region — Real-time Harbour Visits
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-6 flex-1" id="dashboard-layout">
        <div className="flex gap-6 w-full items-stretch justify-center flex-wrap">
          <div className="flex-[0_0_550px] max-w-full h-[650px]">
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <VesselMap vessels={vesselList} />
            </ErrorBoundary>
          </div>

          <div className="flex-[0_0_450px] max-w-full h-[650px]">
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <VisitLog
                visits={visits}
                totalVisits={totalVisits}
                isLoading={isLoadingVisits}
              />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
