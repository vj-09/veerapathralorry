import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Trip, Metrics, DriverStats, CargoStats } from "./types";
import {
  generateCycles,
  filterByDateRange,
  computeMetrics,
  computeDriverStats,
  computeCargoStats,
  computeIntelligence,
  type Cycle,
  type Intelligence,
} from "./compute";

const isDev = import.meta.env.DEV;
const API_BASE = "http://localhost:3002/api";

interface FleetState {
  // Raw
  allTrips: Trip[];
  cycles: Cycle[];
  loading: boolean;
  error: string | null;
  // Filter
  dateFrom: string;
  dateTo: string;
  setDateRange: (from: string, to: string) => void;
  // Derived (from filtered trips)
  filteredTrips: Trip[];
  metrics: Metrics | null;
  prevMetrics: Metrics | null;
  driverStats: Record<string, DriverStats>;
  cargoStats: CargoStats[];
  intelligence: Intelligence;
}

const FleetContext = createContext<FleetState | null>(null);

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be inside FleetProvider");
  return ctx;
}

async function loadTrips(): Promise<Trip[]> {
  if (isDev) {
    const res = await fetch(API_BASE + "/trips");
    if (!res.ok) throw new Error("API error");
    return res.json();
  }
  const res = await fetch("/api/fleet-data.json");
  if (!res.ok) throw new Error("Failed to load data");
  const data = await res.json();
  return data.allTrips;
}

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Load data once
  useEffect(() => {
    loadTrips()
      .then((trips) => {
        setAllTrips(trips);
        // Default to latest billing cycle
        const cycles = generateCycles(trips);
        if (cycles.length > 0) {
          const latest = cycles[cycles.length - 1];
          setDateFrom(latest.from);
          setDateTo(latest.to);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const cycles = useMemo(() => generateCycles(allTrips), [allTrips]);

  const filteredTrips = useMemo(
    () =>
      dateFrom && dateTo
        ? filterByDateRange(allTrips, dateFrom, dateTo)
        : allTrips,
    [allTrips, dateFrom, dateTo],
  );

  const metrics = useMemo(() => computeMetrics(filteredTrips), [filteredTrips]);

  // Previous cycle for comparison
  const prevMetrics = useMemo(() => {
    if (!dateFrom) return null;
    const f = new Date(dateFrom + "T00:00:00");
    const prevTo = new Date(f.getTime() - 86400000);
    const prevFrom = new Date(f);
    prevFrom.setMonth(prevFrom.getMonth() - 1);
    const prev = filterByDateRange(
      allTrips,
      prevFrom.toISOString().slice(0, 10),
      prevTo.toISOString().slice(0, 10),
    );
    return computeMetrics(prev);
  }, [allTrips, dateFrom]);

  const driverStats = useMemo(
    () => computeDriverStats(filteredTrips),
    [filteredTrips],
  );
  const cargoStats = useMemo(
    () => computeCargoStats(filteredTrips),
    [filteredTrips],
  );
  const intelligence = useMemo(
    () => computeIntelligence(allTrips, dateFrom, dateTo),
    [allTrips, dateFrom, dateTo],
  );

  function setDateRange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
  }

  return (
    <FleetContext.Provider
      value={{
        allTrips,
        cycles,
        loading,
        error,
        dateFrom,
        dateTo,
        setDateRange,
        filteredTrips,
        metrics,
        prevMetrics,
        driverStats,
        cargoStats,
        intelligence,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}
