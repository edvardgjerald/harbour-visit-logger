import type { HarbourVisit } from "@vessel/shared";

interface VisitLogProps {
  visits: HarbourVisit[];
  totalVisits: number;
  isLoading: boolean;
}

/** Scrollable list of harbour visits. Pure presentational — all data comes via props. */
export function VisitLog({ visits, totalVisits, isLoading }: VisitLogProps) {
  return (
    <div
      className="flex flex-col bg-gray-900/55 backdrop-blur-[20px] border border-slate-400/15 rounded-2xl shadow-lg shadow-black/40 overflow-hidden transition-colors hover:border-slate-400/25 h-full"
      id="visit-log-card"
    >
      <div className="flex items-center justify-between py-[18px] px-6 border-b border-slate-400/10">
        <span className="text-[0.95rem] font-semibold flex items-center gap-[10px]">
          <span className="text-[1.1rem]">⚓</span>
          Harbour Visits
        </span>
        <span className="text-[0.7rem] py-[3px] px-[10px] rounded-3xl font-semibold font-mono bg-blue-500/15 text-blue-500 border border-blue-500/30">
          {totalVisits} total
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3 text-slate-500">
            <span className="text-[2.5rem] opacity-40">⏳</span>
            <p className="text-[0.85rem]">Loading visits...</p>
          </div>
        ) : visits.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3 text-slate-500"
            id="visit-empty-state"
          >
            <span className="text-[2.5rem] opacity-40">✅</span>
            <p className="text-[0.85rem]">No visits recorded</p>
            <p className="text-[0.75rem] opacity-70">
              Vessels entering the harbour will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col" id="visit-list">
            {visits.map((visit) => (
              <div
                className="py-3.5 px-5 border-b border-slate-400/10 transition-colors hover:bg-gray-800/85 animate-visit-enter last:border-b-0"
                key={visit.id}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[0.85rem] text-blue-500 font-mono truncate mr-2">
                      MMSI {visit.mmsi}
                    </span>
                    {visit.vesselName && (
                      <span className="text-[0.8rem] text-slate-300 truncate whitespace-nowrap">
                        {visit.vesselName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.78rem] text-slate-400 truncate mr-2">
                      <span className="text-slate-500 mr-1">Zone:</span>
                      {visit.zoneName || visit.zoneId}
                    </span>
                    <span className="text-[0.72rem] text-slate-500 font-mono whitespace-nowrap">
                      {new Date(visit.timestamp).toISOString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
