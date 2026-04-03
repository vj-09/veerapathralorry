import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { HOME_BASE } from "../lib/geocode";
import { fmtInr } from "../lib/format";
import {
  getWindows,
  type MappedPoint,
  type OdoWindow,
} from "../lib/odoWindows";
import { Navigation, Upload, MapPin, Clock, Gauge } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  points: MappedPoint[];
  tripColors: Record<string, string>;
  loading: boolean;
  selectedDriver: string;
  onDriverChange: (driver: string) => void;
}

interface StopEvent {
  startTs: string;
  endTs: string;
  durationMin: number;
  lat: number;
  lng: number;
  address: string;
  type: "parked" | "idling";
  odoAt?: number;
}

const UNKNOWN_COLOR = "#64748b";
const DIRS: [string, string][] = [
  ["North", "↑"],
  ["NE", "↗"],
  ["East", "→"],
  ["SE", "↘"],
  ["South", "↓"],
  ["SW", "↙"],
  ["West", "←"],
  ["NW", "↖"],
];

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length >= 2) {
      const Lf = (window as any).L;
      if (Lf) map.fitBounds(Lf.latLngBounds(pts), { padding: [40, 40] });
    }
  }, [pts, map]);
  return null;
}

function computeDayStats(pts: MappedPoint[]) {
  if (!pts.length) return null;
  const wo = pts.filter((p) => p.o && p.o > 0);
  const oMin = wo.length ? Math.min(...wo.map((p) => p.o!)) : 0;
  const oMax = wo.length ? Math.max(...wo.map((p) => p.o!)) : 0;
  const mv = pts.filter((p) => p.st === "moving");
  return {
    distance: Math.round((oMax - oMin) * 10) / 10,
    odoMin: oMin,
    odoMax: oMax,
    firstTs: pts[0].ts,
    lastTs: pts[pts.length - 1].ts,
    maxSpeed: mv.length ? Math.max(...mv.map((p) => p.s || 0)) : 0,
    avgSpeed: mv.length
      ? Math.round(mv.reduce((s, p) => s + (p.s || 0), 0) / mv.length)
      : 0,
  };
}

function findStops(pts: MappedPoint[], minMin = 30): StopEvent[] {
  const stops: StopEvent[] = [];
  let start: MappedPoint | null = null,
    type: "parked" | "idling" = "parked";
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.st !== "moving" && !start) {
      start = p;
      type = p.st === "idling" ? "idling" : "parked";
    } else if (p.st !== "moving" && start) {
      if (p.st === "idling") type = "idling";
    } else if (p.st === "moving" && start) {
      const dur =
        (new Date(p.ts).getTime() - new Date(start.ts).getTime()) / 60000;
      if (dur >= minMin)
        stops.push({
          startTs: start.ts,
          endTs: pts[i - 1].ts,
          durationMin: Math.round(dur),
          lat: start.lat,
          lng: start.lng,
          address:
            start.a || `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}`,
          type,
          odoAt: start.o,
        });
      start = null;
    }
  }
  if (start) {
    const last = pts[pts.length - 1];
    const dur =
      (new Date(last.ts).getTime() - new Date(start.ts).getTime()) / 60000;
    if (dur >= minMin)
      stops.push({
        startTs: start.ts,
        endTs: last.ts,
        durationMin: Math.round(dur),
        lat: start.lat,
        lng: start.lng,
        address: start.a || `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}`,
        type,
      });
  }
  return stops;
}

function computeKmMarkers(pts: MappedPoint[], every = 75) {
  const wo = pts.filter((p) => p.o && p.o > 0);
  if (wo.length < 5) return [];
  const markers: {
    lat: number;
    lng: number;
    time: string;
    dir: string;
    arrow: string;
    address: string;
    odo?: number;
  }[] = [];
  let next = Math.ceil(wo[0].o! / every) * every;
  for (let i = 1; i < wo.length; i++) {
    if (wo[i].o! >= next) {
      const prev = wo[Math.max(0, i - 30)];
      let dir = "Stopped",
        arrow = "●";
      if (
        Math.abs(wo[i].lat - prev.lat) > 0.01 ||
        Math.abs(wo[i].lng - prev.lng) > 0.01
      ) {
        const angle =
          ((Math.atan2(wo[i].lng - prev.lng, wo[i].lat - prev.lat) * 180) /
            Math.PI +
            360) %
          360;
        [dir, arrow] = DIRS[Math.round(angle / 45) % 8];
      }
      markers.push({
        lat: wo[i].lat,
        lng: wo[i].lng,
        time: wo[i].ts.slice(11, 16),
        dir,
        arrow,
        address: wo[i].a || "",
        odo: wo[i].o,
      });
      next += every;
    }
  }
  return markers;
}

const fmtDur = (m: number) => {
  const h = Math.floor(m / 60),
    mm = m % 60;
  return h > 0 ? (mm > 0 ? `${h}h ${mm}m` : `${h}h`) : `${m}m`;
};
const fmtTime = (ts: string) => ts.slice(11, 16);

export default function MapView({
  points: allPoints,
  tripColors,
  loading,
  selectedDriver,
  onDriverChange,
}: Props) {
  const [viewMode, setViewMode] = useState<"day" | "trip">("day");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedTrip, setSelectedTrip] = useState("");

  const windows = useMemo(() => getWindows(selectedDriver), [selectedDriver]);

  useEffect(() => {
    if (allPoints.length && !selectedDay) {
      const days = [...new Set(allPoints.map((p) => p.ts.slice(0, 10)))].sort();
      if (days.length) setSelectedDay(days[days.length - 1]);
    }
  }, [allPoints, selectedDay]);

  useEffect(() => {
    if (windows.length && !selectedTrip) setSelectedTrip(windows[0].label);
  }, [windows, selectedTrip]);

  const days = useMemo(
    () => [...new Set(allPoints.map((p) => p.ts.slice(0, 10)))].sort(),
    [allPoints],
  );
  const recentDays = useMemo(() => days.slice(-7), [days]);

  // DAY VIEW: filter by selected day
  const dayPoints = useMemo(
    () =>
      selectedDay ? allPoints.filter((p) => p.ts.startsWith(selectedDay)) : [],
    [allPoints, selectedDay],
  );

  // TRIP VIEW: filter by odo window across ALL days
  const tripWindow = useMemo(
    () => windows.find((w) => w.label === selectedTrip) || null,
    [windows, selectedTrip],
  );
  const tripPoints = useMemo(() => {
    if (!tripWindow) return [];
    return allPoints.filter(
      (p) => p.o && p.o >= tripWindow.odoStart && p.o <= tripWindow.odoEnd,
    );
  }, [allPoints, tripWindow]);
  const tripDays = useMemo(
    () => [...new Set(tripPoints.map((p) => p.ts.slice(0, 10)))].sort(),
    [tripPoints],
  );
  const tripFirstAddr = useMemo(
    () => tripPoints.find((p) => p.a)?.a || "",
    [tripPoints],
  );
  const tripLastAddr = useMemo(
    () => [...tripPoints].reverse().find((p) => p.a)?.a || "",
    [tripPoints],
  );

  // Active points based on mode
  const points = viewMode === "day" ? dayPoints : tripPoints;

  const mapCoords = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );
  const dayStats = useMemo(() => computeDayStats(points), [points]);
  const stopEvents = useMemo(() => findStops(points, 30), [points]);
  const dirMarkers = useMemo(() => computeKmMarkers(points, 75), [points]);

  // Active trips for this day (from odo mapping) — day view only
  const dayTrips = useMemo(() => {
    if (viewMode !== "day") return [];
    const seen = new Map<string, OdoWindow>();
    points.forEach((p) => {
      if (p.trip && p.window && !seen.has(p.trip)) seen.set(p.trip, p.window);
    });
    return [...seen.entries()].map(([label, w]) => ({
      label,
      window: w,
      color: tripColors[label] || UNKNOWN_COLOR,
    }));
  }, [points, tripColors, viewMode]);

  const hasData = allPoints.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      <div className="bg-slate-800/90 border-b border-slate-700/50 p-2.5 flex items-center gap-2 z-10 shrink-0">
        {hasData && (
          <>
            {/* Tab toggle */}
            <div className="flex bg-slate-900 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setViewMode("day")}
                className={`px-2.5 py-1 text-xs rounded-md ${viewMode === "day" ? "bg-slate-700 text-slate-100" : "text-slate-500"}`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode("trip")}
                className={`px-2.5 py-1 text-xs rounded-md ${viewMode === "trip" ? "bg-slate-700 text-slate-100" : "text-slate-500"}`}
              >
                Trip
              </button>
            </div>

            {/* Day view controls */}
            {viewMode === "day" && (
              <>
                <button
                  onClick={() => {
                    const i = days.indexOf(selectedDay);
                    if (i > 0) setSelectedDay(days[i - 1]);
                  }}
                  disabled={days.indexOf(selectedDay) <= 0}
                  className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                >
                  <span className="text-sm">◀</span>
                </button>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
                >
                  {recentDays.map((d) => (
                    <option key={d} value={d}>
                      {new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </option>
                  ))}
                  <optgroup label="Older">
                    {days.slice(0, -7).map((d) => (
                      <option key={d} value={d}>
                        {new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  onClick={() => {
                    const i = days.indexOf(selectedDay);
                    if (i < days.length - 1) setSelectedDay(days[i + 1]);
                  }}
                  disabled={days.indexOf(selectedDay) >= days.length - 1}
                  className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                >
                  <span className="text-sm">▶</span>
                </button>
              </>
            )}

            {/* Trip view controls */}
            {viewMode === "trip" && (
              <>
                <button
                  onClick={() => {
                    const i = windows.findIndex(
                      (w) => w.label === selectedTrip,
                    );
                    if (i > 0) setSelectedTrip(windows[i - 1].label);
                  }}
                  disabled={
                    windows.findIndex((w) => w.label === selectedTrip) <= 0
                  }
                  className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                >
                  <span className="text-sm">◀</span>
                </button>
                <select
                  value={selectedTrip}
                  onChange={(e) => setSelectedTrip(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
                >
                  {windows.map((w) => (
                    <option key={w.label} value={w.label}>
                      {w.label} — {w.from} → {w.to} ({w.odoEnd - w.odoStart}km)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const i = windows.findIndex(
                      (w) => w.label === selectedTrip,
                    );
                    if (i < windows.length - 1)
                      setSelectedTrip(windows[i + 1].label);
                  }}
                  disabled={
                    windows.findIndex((w) => w.label === selectedTrip) >=
                    windows.length - 1
                  }
                  className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                >
                  <span className="text-sm">▶</span>
                </button>
              </>
            )}

            <select
              value={selectedDriver}
              onChange={(e) => onDriverChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5"
            >
              <option value="Senthil">Senthil T2</option>
              <option value="Kumar">Kumar T1</option>
            </select>

            {dayStats && (
              <div className="flex gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Gauge size={13} className="text-green-400" />{" "}
                  {dayStats.distance} km
                </span>
                <span>
                  <span className="text-slate-500">Max</span>{" "}
                  {dayStats.maxSpeed} km/h
                </span>
                <span className="hidden sm:inline">
                  <span className="text-slate-500">Avg</span>{" "}
                  {dayStats.avgSpeed} km/h
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-amber-400" />{" "}
                  {stopEvents.length} stops
                </span>
              </div>
            )}
            <span className="text-xs text-slate-500 ml-auto">
              {points.length} pts
            </span>
          </>
        )}
      </div>

      {/* Trip info bar — day view: matched trips, trip view: selected trip details */}
      {viewMode === "day" && dayTrips.length > 0 && (
        <div
          className="border-b border-slate-700/30 px-3 py-2 flex flex-wrap gap-3 z-10 shrink-0"
          style={{ background: "rgba(15,23,42,0.9)" }}
        >
          {dayTrips.map((dt) => (
            <div key={dt.label} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: dt.color }}
              />
              <span className="font-black" style={{ color: dt.color }}>
                {dt.label}
              </span>
              <span className="text-slate-300 truncate max-w-40">
                {dt.window.from} → {dt.window.to}
              </span>
              <span className="text-slate-500 text-xs">{dt.window.cargo}</span>
              <span className="text-slate-200 font-medium">
                {fmtInr(dt.window.revenue)}
              </span>
              <span className="text-slate-500 text-xs">
                odo {dt.window.odoStart}→{dt.window.odoEnd}
              </span>
            </div>
          ))}
        </div>
      )}
      {viewMode === "trip" && tripWindow && (
        <div
          className="border-b border-slate-700/30 px-3 py-2 z-10 shrink-0"
          style={{ background: "rgba(15,23,42,0.9)" }}
        >
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: tripColors[selectedTrip] || UNKNOWN_COLOR }}
            />
            <span
              className="font-black text-lg"
              style={{ color: tripColors[selectedTrip] || UNKNOWN_COLOR }}
            >
              {selectedTrip}
            </span>
            <span className="text-slate-200">
              {tripWindow.from} → {tripWindow.to}
            </span>
            <span className="text-slate-500 text-xs">{tripWindow.cargo}</span>
            <span className="text-slate-200 font-medium">
              {fmtInr(tripWindow.revenue)}
            </span>
            <span className="text-slate-500 text-xs">
              {tripWindow.odoEnd - tripWindow.odoStart}km
            </span>
            <span className="text-slate-500 text-xs">
              odo {tripWindow.odoStart}→{tripWindow.odoEnd}
            </span>
            <span className="text-slate-500 text-xs">
              {tripDays.length} day{tripDays.length > 1 ? "s" : ""}
            </span>
            <span className="text-slate-500 text-xs">
              {stopEvents.length} stops
            </span>
          </div>
          {tripFirstAddr && (
            <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
              <span>Start: {tripFirstAddr.slice(0, 60)}</span>
              <span>→</span>
              <span>End: {tripLastAddr.slice(0, 60)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row relative">
        {hasData && stopEvents.length > 0 && (
          <div className="md:w-72 bg-slate-800/95 border-b md:border-b-0 md:border-r border-slate-700/50 shrink-0 overflow-y-auto z-10 max-h-48 md:max-h-none">
            <div className="p-3 border-b border-slate-700/30">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {selectedDriver} T{selectedDriver === "Senthil" ? "2" : "1"} ·
                Stops &gt; 30 min
              </div>
              {dayStats && (
                <div className="text-[10px] text-slate-500 mt-1">
                  {dayStats.distance} km · Odo {Math.round(dayStats.odoMin)}→
                  {Math.round(dayStats.odoMax)} · {fmtTime(dayStats.firstTs)}–
                  {fmtTime(dayStats.lastTs)}
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-700/20">
              {stopEvents.map((stop, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${stop.type === "idling" ? "bg-amber-500" : "bg-slate-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-medium truncate">
                        {stop.address}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <Clock size={10} />
                        <span>
                          {fmtTime(stop.startTs)}–{fmtTime(stop.endTs)}
                        </span>
                        <span
                          className={`font-bold ${stop.durationMin >= 120 ? "text-red-400" : stop.durationMin >= 60 ? "text-amber-400" : "text-slate-300"}`}
                        >
                          {fmtDur(stop.durationMin)}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-0.5 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${stop.type === "idling" ? "bg-amber-500/15 text-amber-400" : "bg-slate-500/15 text-slate-400"}`}
                        >
                          {stop.type === "idling" ? "Stopped" : "Engine OFF"}
                        </span>
                        {stop.odoAt != null && (
                          <span className="text-slate-500">
                            @{Math.round(stop.odoAt)}km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1">
          <MapContainer
            center={HOME_BASE}
            zoom={8}
            className="h-full w-full"
            style={{ background: "#0f172a" }}
          >
            <TileLayer
              attribution="&copy; OSM"
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {mapCoords.length > 1 && <FitBounds pts={mapCoords} />}

            {points.map((p, i) => {
              const color = p.trip
                ? tripColors[p.trip] || UNKNOWN_COLOR
                : UNKNOWN_COLOR;
              return (
                <CircleMarker
                  key={i}
                  center={[p.lat, p.lng]}
                  radius={p.trip ? 4 : 3}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: p.trip ? 0.85 : 0.5,
                    color,
                    weight: 0.5,
                    opacity: 0.3,
                  }}
                >
                  <Popup>
                    <div
                      style={{ color: "#1e293b", minWidth: 200, fontSize: 12 }}
                    >
                      {p.a && (
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: 13,
                            marginBottom: 3,
                          }}
                        >
                          <Navigation
                            size={12}
                            style={{
                              display: "inline",
                              marginRight: 4,
                              color: "#3b82f6",
                            }}
                          />
                          {p.a}
                        </div>
                      )}
                      {p.trip && p.window && (
                        <div
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#fff",
                            background: tripColors[p.trip] || UNKNOWN_COLOR,
                            marginBottom: 4,
                          }}
                        >
                          {p.trip} · {p.window.from} → {p.window.to}
                        </div>
                      )}
                      {!p.trip && (
                        <div
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#fff",
                            background: UNKNOWN_COLOR,
                            marginBottom: 4,
                          }}
                        >
                          No trip mapped
                        </div>
                      )}
                      <div
                        style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}
                      >
                        {p.ts}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          marginTop: 6,
                          fontSize: 11,
                        }}
                      >
                        {p.s != null && (
                          <span>
                            Speed: <strong>{p.s} km/h</strong>
                          </span>
                        )}
                        {p.o != null && (
                          <span>
                            Odo: <strong>{Math.round(p.o)}km</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {stopEvents.map((stop, i) => (
              <CircleMarker
                key={`s-${i}`}
                center={[stop.lat, stop.lng]}
                radius={10}
                pathOptions={{
                  fillColor: "#f59e0b",
                  fillOpacity: 0.9,
                  color: "#fff",
                  weight: 2,
                  opacity: 0.6,
                }}
              >
                <Popup>
                  <div
                    style={{ color: "#1e293b", minWidth: 220, fontSize: 12 }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      <MapPin
                        size={13}
                        style={{ display: "inline", marginRight: 4 }}
                      />
                      {stop.address}
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>{fmtDur(stop.durationMin)}</strong> ·{" "}
                      {fmtTime(stop.startTs)}–{fmtTime(stop.endTs)}
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#f59e0b",
                      }}
                    >
                      {stop.type === "idling" ? "Stopped" : "Engine OFF"}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {dirMarkers.map((dm, i) => {
              const bg = dm.dir !== "Stopped" ? "#22c55e" : "#64748b";
              return (
                <Marker
                  key={`d-${i}`}
                  position={[dm.lat, dm.lng]}
                  icon={L.divIcon({
                    className: "",
                    html: `<div style="background:${bg};color:#fff;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:3px;opacity:0.5"><span style="font-size:12px">${dm.arrow}</span>${dm.time} ${dm.dir}</div>`,
                    iconSize: [100, 20],
                    iconAnchor: [50, 10],
                  })}
                >
                  <Popup>
                    <div
                      style={{ color: "#1e293b", minWidth: 220, fontSize: 12 }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 15 }}>
                        {dm.arrow} {dm.time} — {dm.dir}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {dm.address.slice(0, 80)}
                      </div>
                      {dm.odo != null && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          Odo: {Math.round(dm.odo)} km
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {!hasData && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-slate-800/95 border border-slate-700/50 rounded-2xl p-8 max-w-md text-center">
            <Upload size={32} className="text-slate-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-200 mb-2">
              No GPS Data for {selectedDriver}
            </h2>
            <p className="text-sm text-slate-400">
              Drop iAlert export in{" "}
              <code className="text-orange-400">data/gps/</code> →{" "}
              <code className="text-orange-400">npm run build:gps</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
