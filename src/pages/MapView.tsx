import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HOME_BASE } from "../lib/geocode";
import { Navigation, Upload } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/*
  First principles GPS map.
  - Plots raw GPS data points as small dots
  - Color by time (morning→night gradient)
  - Day picker to view one day at a time
  - No approximations, no guessed routes, no fake lines
  - Drop GPS data in data/gps/ folder (JSON/CSV)

  GPS point format:
  { lat, lng, timestamp, speed?, fuel?, odometer?, address? }
*/

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: string; // ISO or any parseable
  speed?: number;
  fuel?: number;
  odometer?: number;
  address?: string;
  vehicle?: string;
}

// Time → color (blue dawn → green morning → yellow noon → orange evening → purple night)
function timeColor(hour: number): string {
  if (hour < 6) return "#818cf8"; // indigo - night
  if (hour < 9) return "#38bdf8"; // sky - dawn
  if (hour < 12) return "#22c55e"; // green - morning
  if (hour < 15) return "#eab308"; // yellow - noon
  if (hour < 18) return "#f97316"; // orange - afternoon
  if (hour < 21) return "#ef4444"; // red - evening
  return "#818cf8"; // indigo - night
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const L = (window as any).L;
      if (L) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function MapView() {
  const [allPoints, setAllPoints] = useState<GPSPoint[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load GPS data from static JSON
  useEffect(() => {
    fetch("/api/gps-points.json")
      .then((r) => {
        if (!r.ok) throw new Error("No GPS data yet");
        return r.json();
      })
      .then((data: GPSPoint[]) => {
        setAllPoints(data);
        // Default to latest day
        const days = [
          ...new Set(data.map((p) => p.timestamp.slice(0, 10))),
        ].sort();
        if (days.length > 0) setSelectedDay(days[days.length - 1]);
        setLoading(false);
      })
      .catch(() => {
        setAllPoints([]);
        setLoading(false);
      });
  }, []);

  // Available days
  const days = useMemo(() => {
    return [...new Set(allPoints.map((p) => p.timestamp.slice(0, 10)))].sort();
  }, [allPoints]);

  // Filter by selected day
  const points = useMemo(() => {
    if (selectedDay === "all") return allPoints;
    return allPoints.filter((p) => p.timestamp.startsWith(selectedDay));
  }, [allPoints, selectedDay]);

  // Map coords for bounds
  const mapCoords = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );

  const hasData = allPoints.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Controls */}
      <div className="bg-slate-800/90 border-b border-slate-700/50 p-2.5 flex items-center gap-2 z-10 shrink-0 overflow-x-auto">
        {hasData && (
          <>
            <span className="text-xs text-slate-500 shrink-0">Day:</span>
            <div className="flex gap-1">
              {days.map((d) => {
                const label = new Date(d + "T00:00:00").toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short" },
                );
                const count = allPoints.filter((p) =>
                  p.timestamp.startsWith(d),
                ).length;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                      selectedDay === d
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-slate-900 text-slate-400 border border-slate-700/50 hover:text-slate-200"
                    }`}
                  >
                    {label}{" "}
                    <span className="text-[10px] opacity-60">({count})</span>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedDay("all")}
                className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg ${
                  selectedDay === "all"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-slate-900 text-slate-400 border border-slate-700/50"
                }`}
              >
                All
              </button>
            </div>
            <span className="text-xs text-slate-500 ml-auto shrink-0">
              {points.length} points
            </span>
          </>
        )}
        {!hasData && !loading && (
          <span className="text-xs text-slate-500">No GPS data loaded</span>
        )}
      </div>

      <div className="flex-1 relative">
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
          {mapCoords.length > 1 && <FitBounds points={mapCoords} />}

          {/* Raw GPS dots */}
          {points.map((p, i) => {
            const hour = new Date(p.timestamp).getHours();
            const color = timeColor(hour);
            const time = new Date(p.timestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <CircleMarker
                key={i}
                center={[p.lat, p.lng]}
                radius={4}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.8,
                  color: color,
                  weight: 1,
                  opacity: 0.4,
                }}
              >
                <Popup>
                  <div
                    style={{ color: "#1e293b", minWidth: 200, fontSize: 12 }}
                  >
                    {p.address && (
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: 14,
                          marginBottom: 4,
                        }}
                      >
                        <Navigation
                          size={13}
                          style={{
                            display: "inline",
                            marginRight: 4,
                            color: "#3b82f6",
                          }}
                        />
                        {p.address}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {p.timestamp}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}
                    >
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
                      {p.speed != null && (
                        <span>
                          Speed: <strong>{p.speed} km/h</strong>
                        </span>
                      )}
                      {p.fuel != null && (
                        <span>
                          Fuel: <strong>{p.fuel}L</strong>
                        </span>
                      )}
                      {p.odometer != null && (
                        <span>
                          Odo: <strong>{p.odometer}km</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Empty state overlay */}
        {!hasData && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
            <div className="bg-slate-800/95 border border-slate-700/50 rounded-2xl p-8 max-w-md text-center pointer-events-auto">
              <Upload size={32} className="text-slate-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-200 mb-2">
                Drop GPS Data
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Run <code className="text-orange-400">npm run build:gps</code>{" "}
                after placing iAlert exports in{" "}
                <code className="text-orange-400">data/gps/</code>
              </p>
              <div className="text-left bg-slate-900/60 rounded-lg p-4 text-xs text-slate-400 space-y-1.5">
                <div className="text-slate-500 font-semibold uppercase text-[10px] mb-2">
                  Expected format (JSON array):
                </div>
                <pre className="text-[11px] text-cyan-400 overflow-x-auto">{`[
  {
    "lat": 10.55,
    "lng": 79.33,
    "timestamp": "2026-03-21T14:30:00",
    "speed": 45,
    "fuel": 75,
    "odometer": 20190,
    "address": "SH 146, Ullikottai, TN"
  }
]`}</pre>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Color: <span style={{ color: "#38bdf8" }}>dawn</span> →{" "}
                <span style={{ color: "#22c55e" }}>morning</span> →{" "}
                <span style={{ color: "#eab308" }}>noon</span> →{" "}
                <span style={{ color: "#f97316" }}>evening</span> →{" "}
                <span style={{ color: "#818cf8" }}>night</span>
              </div>
            </div>
          </div>
        )}

        {/* Time legend */}
        {hasData && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-slate-800/90 border border-slate-700/50 rounded-lg px-3 py-2 flex gap-2 items-center text-[10px]">
            <span className="text-slate-500">Time:</span>
            {[
              { h: 3, label: "Night" },
              { h: 7, label: "Dawn" },
              { h: 10, label: "AM" },
              { h: 13, label: "Noon" },
              { h: 16, label: "PM" },
              { h: 19, label: "Eve" },
            ].map((t) => (
              <span key={t.h} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: timeColor(t.h) }}
                />
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
