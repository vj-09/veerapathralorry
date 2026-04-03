import { useMemo } from "react";
import { useFleet } from "../lib/FleetContext";
import { fmtInr, fmtDate, tierBadge } from "../lib/format";
import type { Trip } from "../lib/types";
import {
  MapPin,
  Truck,
  Package,
  PackageOpen,
  Clock,
  Fuel,
  ArrowRight,
  CircleDot,
  TrendingUp,
} from "lucide-react";

/*
  GPS + Load Inference page.
  Phase 1: Infers loaded/empty from trip lifecycle (origin→destination = loaded, return = empty)
  Phase 2 (when weekly GPS drops arrive): Add fuel burn rate analysis overlay
*/

interface TripSegment {
  type: "loaded" | "empty" | "idle";
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  days: number;
  km: number | null;
  trip: Trip | null;
  fuelBurnEst: number | null; // L/km estimated
}

function buildTimeline(trips: Trip[]): TripSegment[] {
  const sorted = [...trips]
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const segments: TripSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];

    // LOADED segment: origin → destination
    segments.push({
      type: "loaded",
      from: t.from || "?",
      to: t.to || "?",
      fromDate: t.date,
      toDate: t.date,
      days: t.calDays || 1,
      km: t.km,
      trip: t,
      fuelBurnEst: t.km && t.diesel ? t.diesel / t.km : null,
    });

    // GAP to next trip: empty return or idle
    if (i + 1 < sorted.length) {
      const next = sorted[i + 1];
      const gapDays = Math.max(
        0,
        Math.ceil(
          (new Date(next.date + "T00:00:00").getTime() -
            new Date(t.date + "T00:00:00").getTime()) /
            86400000,
        ) - (t.calDays || 1),
      );

      if (gapDays > 0) {
        // If destination ≠ next origin, there's a return trip (empty)
        const isReturn = t.to && next.from && t.to !== next.from;
        segments.push({
          type: isReturn ? "empty" : "idle",
          from: t.to || "?",
          to: isReturn ? next.from || "?" : t.to || "Same location",
          fromDate: t.date,
          toDate: next.date,
          days: gapDays,
          km: null,
          trip: null,
          fuelBurnEst: null,
        });
      }
    }
  }
  return segments;
}

interface StopPoint {
  location: string;
  type: "loading" | "unloading" | "home" | "unknown";
  visits: number;
  totalTons: number;
  cargos: string[];
  dates: string[];
}

function buildStopPoints(trips: Trip[]): StopPoint[] {
  const map: Record<string, StopPoint> = {};

  for (const t of trips) {
    // Origin = loading point
    if (t.from) {
      const key = t.from.toLowerCase().trim();
      if (!map[key])
        map[key] = {
          location: t.from,
          type: "loading",
          visits: 0,
          totalTons: 0,
          cargos: [],
          dates: [],
        };
      map[key].visits++;
      map[key].totalTons += t.weight || 0;
      if (t.cargo && !map[key].cargos.includes(t.cargo))
        map[key].cargos.push(t.cargo);
      map[key].dates.push(t.date);
    }

    // Destination = unloading point
    if (t.to) {
      const key = "dest_" + t.to.toLowerCase().trim();
      if (!map[key])
        map[key] = {
          location: t.to,
          type: "unloading",
          visits: 0,
          totalTons: 0,
          cargos: [],
          dates: [],
        };
      map[key].visits++;
      map[key].totalTons += t.weight || 0;
      if (t.cargo && !map[key].cargos.includes(t.cargo))
        map[key].cargos.push(t.cargo);
    }
  }

  return Object.values(map).sort((a, b) => b.visits - a.visits);
}

export default function GPS() {
  const { filteredTrips, dateFrom, dateTo } = useFleet();

  const senthilTrips = useMemo(
    () =>
      filteredTrips
        .filter((t) => t.driver === "Senthil")
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [filteredTrips],
  );
  const kumarTrips = useMemo(
    () =>
      filteredTrips
        .filter((t) => t.driver === "Kumar")
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [filteredTrips],
  );

  const senthilTimeline = useMemo(
    () => buildTimeline(senthilTrips),
    [senthilTrips],
  );
  const kumarTimeline = useMemo(() => buildTimeline(kumarTrips), [kumarTrips]);

  const allStops = useMemo(
    () => buildStopPoints(filteredTrips),
    [filteredTrips],
  );

  // Stats
  const stats = useMemo(() => {
    const calc = (segs: TripSegment[]) => {
      const loaded = segs.filter((s) => s.type === "loaded");
      const empty = segs.filter((s) => s.type === "empty");
      const idle = segs.filter((s) => s.type === "idle");
      const loadedDays = loaded.reduce((s, x) => s + x.days, 0);
      const emptyDays = empty.reduce((s, x) => s + x.days, 0);
      const idleDays = idle.reduce((s, x) => s + x.days, 0);
      const loadedKm = loaded.reduce((s, x) => s + (x.km || 0), 0);
      return {
        loadedDays,
        emptyDays,
        idleDays,
        loadedKm,
        totalSegments: segs.length,
      };
    };
    return {
      senthil: calc(senthilTimeline),
      kumar: calc(kumarTimeline),
    };
  }, [senthilTimeline, kumarTimeline]);

  if (!filteredTrips.length)
    return <div className="p-8 text-slate-500">No trips in this range.</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">
          GPS & Load Inference
        </h1>
        <p className="text-xs text-slate-500">
          {dateFrom} to {dateTo} &middot; Loaded / Empty / Idle inferred from
          trip lifecycle
        </p>
      </div>

      {/* Utilization Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { driver: "Senthil T2", s: stats.senthil, hasGPS: true },
          { driver: "Kumar T1", s: stats.kumar, hasGPS: false },
        ].map(({ driver, s, hasGPS }) => {
          const total = s.loadedDays + s.emptyDays + s.idleDays || 1;
          const loadPct = Math.round((s.loadedDays / total) * 100);
          const emptyPct = Math.round((s.emptyDays / total) * 100);
          const idlePct = 100 - loadPct - emptyPct;
          return (
            <div
              key={driver}
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Truck size={16} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-200">
                  {driver}
                </span>
                {hasGPS && (
                  <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full">
                    GPS Active
                  </span>
                )}
                {!hasGPS && (
                  <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">
                    GPS Offline
                  </span>
                )}
              </div>
              {/* Stacked bar */}
              <div className="flex rounded-lg overflow-hidden h-5 mb-2">
                <div
                  className="bg-green-500 flex items-center justify-center text-[9px] text-white font-medium"
                  style={{ width: `${loadPct}%` }}
                >
                  {loadPct > 10 && `${loadPct}%`}
                </div>
                <div
                  className="bg-amber-500 flex items-center justify-center text-[9px] text-white font-medium"
                  style={{ width: `${emptyPct}%` }}
                >
                  {emptyPct > 10 && `${emptyPct}%`}
                </div>
                <div
                  className="bg-slate-600 flex items-center justify-center text-[9px] text-white font-medium"
                  style={{ width: `${idlePct}%` }}
                >
                  {idlePct > 10 && `${idlePct}%`}
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-green-400">
                  <Package size={12} className="inline mr-1" />
                  Loaded {s.loadedDays}d
                </span>
                <span className="text-amber-400">
                  <PackageOpen size={12} className="inline mr-1" />
                  Empty {s.emptyDays}d
                </span>
                <span className="text-slate-400">
                  <Clock size={12} className="inline mr-1" />
                  Idle {s.idleDays}d
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trip Timeline — T2 Senthil */}
      {[
        { driver: "Senthil T2", timeline: senthilTimeline },
        { driver: "Kumar T1", timeline: kumarTimeline },
      ].map(({ driver, timeline }) => (
        <section
          key={driver}
          className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200">
              {driver} — Trip Timeline
            </h2>
          </div>

          {/* Mobile + Desktop timeline */}
          <div className="space-y-1">
            {timeline.map((seg, i) => {
              const isLoaded = seg.type === "loaded";
              const isEmpty = seg.type === "empty";
              const tb = seg.trip ? tierBadge(seg.trip.tier) : null;

              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-2.5 rounded-lg ${
                    isLoaded
                      ? "bg-green-500/5 border border-green-500/10"
                      : isEmpty
                        ? "bg-amber-500/5 border border-amber-500/10"
                        : "bg-slate-900/30 border border-slate-700/20"
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {isLoaded && (
                      <Package size={16} className="text-green-400" />
                    )}
                    {isEmpty && (
                      <PackageOpen size={16} className="text-amber-400" />
                    )}
                    {!isLoaded && !isEmpty && (
                      <Clock size={16} className="text-slate-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-bold uppercase ${
                          isLoaded
                            ? "text-green-400"
                            : isEmpty
                              ? "text-amber-400"
                              : "text-slate-500"
                        }`}
                      >
                        {seg.type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {fmtDate(seg.fromDate)}
                      </span>
                      {seg.days > 0 && (
                        <span className="text-[10px] text-slate-600">
                          {seg.days}d
                        </span>
                      )}
                      {seg.trip && tb && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${tb.bg} ${tb.color} border ${tb.border}`}
                        >
                          {tb.emoji} {tb.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-300 mt-0.5 truncate">
                      {seg.from}{" "}
                      <ArrowRight size={12} className="inline text-slate-600" />{" "}
                      {seg.to}
                    </div>
                    {seg.trip && (
                      <div className="flex gap-3 mt-1 text-xs text-slate-400">
                        {seg.trip.cargo && <span>{seg.trip.cargo}</span>}
                        {seg.trip.weight && <span>{seg.trip.weight}T</span>}
                        <span>{fmtInr(seg.trip.revenue)} rev</span>
                        <span
                          className={
                            seg.trip.trueProfit >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {fmtInr(seg.trip.trueProfit)} profit
                        </span>
                        {seg.trip.perDay > 0 && (
                          <span>{fmtInr(seg.trip.perDay)}/day</span>
                        )}
                      </div>
                    )}
                    {isEmpty && (
                      <div className="text-[10px] text-amber-400/60 mt-0.5">
                        Empty return — no revenue. Backhaul opportunity.
                      </div>
                    )}
                  </div>

                  {/* Fuel burn estimate */}
                  {seg.fuelBurnEst && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-500">Fuel/km</div>
                      <div
                        className={`text-xs font-medium ${seg.fuelBurnEst > 0.22 ? "text-green-400" : "text-amber-400"}`}
                      >
                        {seg.fuelBurnEst.toFixed(2)} L/km
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Stop Points Directory */}
      <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <div className="flex items-center gap-2 mb-4">
          <CircleDot size={16} className="text-purple-400" />
          <h2 className="text-sm font-bold text-slate-200">
            Stop Points — All Known Locations
          </h2>
          <span className="ml-auto text-xs text-slate-500">
            {allStops.length} locations
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {allStops.map((stop, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-slate-900/30 rounded-lg p-3"
            >
              <div
                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${stop.type === "loading" ? "bg-green-500" : "bg-orange-500"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 font-medium">
                  {stop.location}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span
                    className={
                      stop.type === "loading"
                        ? "text-green-400"
                        : "text-orange-400"
                    }
                  >
                    {stop.type === "loading" ? "Loading" : "Unloading"}
                  </span>
                  <span>{stop.visits}x visited</span>
                  {stop.totalTons > 0 && (
                    <span>{Math.round(stop.totalTons)}T total</span>
                  )}
                </div>
                {stop.cargos.length > 0 && (
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {stop.cargos.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fuel Inference Ready Banner */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Fuel size={16} className="text-cyan-400" />
          <span className="text-sm font-bold text-cyan-400">
            Fuel Burn Analysis — Ready for GPS Data
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Drop weekly iAlert exports in{" "}
          <code className="text-cyan-400">data/gps/</code> folder. The system
          will compute fuel burn rate per segment:
        </p>
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <div className="bg-slate-900/40 rounded-lg p-2">
            <div className="text-[10px] text-slate-500">Empty</div>
            <div className="text-sm font-bold text-amber-400">
              0.15–0.18 L/km
            </div>
            <div className="text-[10px] text-slate-600">5.5–6.5 km/L</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2">
            <div className="text-[10px] text-slate-500">Loaded 25T</div>
            <div className="text-sm font-bold text-green-400">
              0.25–0.30 L/km
            </div>
            <div className="text-[10px] text-slate-600">3.3–4.0 km/L</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2">
            <div className="text-[10px] text-slate-500">Overloaded 35T+</div>
            <div className="text-sm font-bold text-red-400">0.30–0.40 L/km</div>
            <div className="text-[10px] text-slate-600">2.5–3.3 km/L</div>
          </div>
        </div>
      </div>
    </div>
  );
}
