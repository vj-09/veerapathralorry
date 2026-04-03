import { useEffect, useMemo, useState, useCallback } from "react";
import { useFleet } from "../lib/FleetContext";
import { fmtInr, fmtDate, tierBadge } from "../lib/format";
import { getCoords, HOME_BASE } from "../lib/geocode";
import type { Trip } from "../lib/types";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Package, PackageOpen, MapPin } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── OSRM route fetcher ─────────────────────────────────
interface RouteCache {
  [key: string]: [number, number][];
}
const routeCache: RouteCache = {};

async function fetchRoute(
  from: [number, number],
  to: [number, number],
): Promise<[number, number][]> {
  const key = `${from[0]},${from[1]}-${to[0]},${to[1]}`;
  if (routeCache[key]) return routeCache[key];
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]?.geometry?.coordinates) {
      const coords = data.routes[0].geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number],
      );
      routeCache[key] = coords;
      return coords;
    }
  } catch {
    /* fall through */
  }
  // Fallback: straight line
  const line = [from, to];
  routeCache[key] = line;
  return line;
}

// ─── Fit map bounds to route ─────────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const L = (window as any).L;
      if (L) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [points, map]);
  return null;
}

// ─── Route segment with resolved geometry ────────────────
interface RouteSeg {
  type: "loaded" | "empty";
  from: [number, number];
  to: [number, number];
  fromCity: string;
  toCity: string;
  trip: Trip | null;
  points: [number, number][];
}

export default function MapView() {
  const { filteredTrips } = useFleet();
  const [selectedDriver, setSelectedDriver] = useState("Senthil");
  const [selectedTrip, setSelectedTrip] = useState<number | "all">("all");
  const [routes, setRoutes] = useState<RouteSeg[]>([]);
  const [loading, setLoading] = useState(false);

  const driverTrips = useMemo(
    () =>
      filteredTrips
        .filter(
          (t) =>
            t.driver === selectedDriver &&
            t.from &&
            t.to &&
            !t.from.startsWith("("),
        )
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [filteredTrips, selectedDriver],
  );

  const tripsToShow = useMemo(
    () =>
      selectedTrip === "all"
        ? driverTrips
        : driverTrips.filter((t) => t.tripNum === selectedTrip),
    [driverTrips, selectedTrip],
  );

  // Build route segments and fetch road geometry
  const buildRoutes = useCallback(async () => {
    setLoading(true);
    const segs: RouteSeg[] = [];

    for (let i = 0; i < tripsToShow.length; i++) {
      const t = tripsToShow[i];
      const fromCoord = getCoords(t.from);
      const toCoord = getCoords(t.to);
      if (!fromCoord || !toCoord) continue;

      // LOADED: origin → destination (green)
      const loadedPts = await fetchRoute(fromCoord, toCoord);
      segs.push({
        type: "loaded",
        from: fromCoord,
        to: toCoord,
        fromCity: t.from,
        toCity: t.to,
        trip: t,
        points: loadedPts,
      });

      // EMPTY RETURN: destination → next trip origin (amber dashed)
      const next = i + 1 < tripsToShow.length ? tripsToShow[i + 1] : null;
      const returnTo = next ? getCoords(next.from) : HOME_BASE;
      if (
        returnTo &&
        (returnTo[0] !== toCoord[0] || returnTo[1] !== toCoord[1])
      ) {
        const emptyPts = await fetchRoute(toCoord, returnTo);
        segs.push({
          type: "empty",
          from: toCoord,
          to: returnTo,
          fromCity: t.to,
          toCity: next?.from || "Home Base",
          trip: null,
          points: emptyPts,
        });
      }
    }
    setRoutes(segs);
    setLoading(false);
  }, [tripsToShow]);

  useEffect(() => {
    buildRoutes();
  }, [buildRoutes]);

  // All points for fitting bounds
  const allPoints = useMemo(() => routes.flatMap((r) => r.points), [routes]);

  // Stats
  const loadedSegs = routes.filter((r) => r.type === "loaded");
  const emptySegs = routes.filter((r) => r.type === "empty");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Controls */}
      <div className="bg-slate-800/90 border-b border-slate-700/50 p-3 flex flex-wrap gap-2 items-center z-10 shrink-0">
        <select
          value={selectedDriver}
          onChange={(e) => {
            setSelectedDriver(e.target.value);
            setSelectedTrip("all");
          }}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="Senthil">Senthil T2</option>
          <option value="Kumar">Kumar T1</option>
        </select>
        <select
          value={selectedTrip}
          onChange={(e) =>
            setSelectedTrip(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 max-w-60"
        >
          <option value="all">All Trips ({driverTrips.length})</option>
          {driverTrips.map((t) => (
            <option key={t.tripNum} value={t.tripNum}>
              T{t.tripNum} {fmtDate(t.date)} {t.from}→{t.to}
            </option>
          ))}
        </select>
        {loading && (
          <span className="text-xs text-slate-500 animate-pulse">
            Loading routes...
          </span>
        )}

        {/* Legend */}
        <div className="flex gap-3 ml-auto text-xs">
          <span className="flex items-center gap-1">
            <span className="w-4 h-1 bg-green-500 rounded-full inline-block" />
            <Package size={12} className="text-green-400" /> Loaded
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-4 h-1 bg-amber-500 rounded-full inline-block opacity-60"
              style={{ borderTop: "2px dashed #f59e0b" }}
            />
            <PackageOpen size={12} className="text-amber-400" /> Empty
          </span>
          <span className="text-slate-500">
            {loadedSegs.length} loaded · {emptySegs.length} empty
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={HOME_BASE}
          zoom={7}
          className="h-full w-full"
          style={{ background: "#0f172a" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {allPoints.length > 0 && <FitBounds points={allPoints} />}

          {/* Route lines */}
          {routes.map((seg, i) => (
            <Polyline
              key={i}
              positions={seg.points}
              pathOptions={{
                color: seg.type === "loaded" ? "#22c55e" : "#f59e0b",
                weight: seg.type === "loaded" ? 4 : 3,
                opacity: seg.type === "loaded" ? 0.9 : 0.5,
                dashArray: seg.type === "empty" ? "8 6" : undefined,
              }}
            />
          ))}

          {/* Stop markers */}
          {routes.map((seg, i) => (
            <CircleMarker
              key={`from-${i}`}
              center={seg.from}
              radius={seg.type === "loaded" ? 7 : 4}
              pathOptions={{
                fillColor: seg.type === "loaded" ? "#22c55e" : "#f59e0b",
                fillOpacity: 0.9,
                color: "#0f172a",
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ color: "#1e293b", minWidth: 180 }}>
                  <div style={{ fontWeight: "bold", fontSize: 14 }}>
                    <MapPin
                      size={14}
                      style={{ display: "inline", marginRight: 4 }}
                    />
                    {seg.fromCity}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {seg.type === "loaded"
                      ? "Loading Point"
                      : "Unloading Point (return start)"}
                  </div>
                  {seg.trip && (
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 6,
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: 4,
                      }}
                    >
                      <div>
                        T{seg.trip.tripNum} · {fmtDate(seg.trip.date)}
                      </div>
                      <div>
                        {seg.trip.cargo}{" "}
                        {seg.trip.weight ? `· ${seg.trip.weight}T` : ""}
                      </div>
                      <div style={{ fontWeight: "bold" }}>
                        {fmtInr(seg.trip.revenue)} rev →{" "}
                        {fmtInr(seg.trip.trueProfit)} profit
                      </div>
                      <div>
                        {seg.trip.perDay > 0
                          ? `${fmtInr(seg.trip.perDay)}/day`
                          : ""}{" "}
                        {tierBadge(seg.trip.tier).emoji}
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Last destination marker */}
          {routes.length > 0 &&
            (() => {
              const last = routes[routes.length - 1];
              return (
                <CircleMarker
                  center={last.to}
                  radius={7}
                  pathOptions={{
                    fillColor: "#ef4444",
                    fillOpacity: 0.9,
                    color: "#0f172a",
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ color: "#1e293b" }}>
                      <div style={{ fontWeight: "bold", fontSize: 14 }}>
                        {last.toCity}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {last.type === "loaded"
                          ? "Unloading Point"
                          : "Return destination"}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })()}
        </MapContainer>
      </div>
    </div>
  );
}
