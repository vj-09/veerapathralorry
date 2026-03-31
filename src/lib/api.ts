import type {
  Trip,
  Metrics,
  DriverStats,
  CargoStats,
  CostStructure,
} from "./types";

// Dev → Express API on :3002. Prod → pre-built static JSON.
const isDev = import.meta.env.DEV;
const API_BASE = "http://localhost:3002/api";

// ─── Dev mode: hit Express ──────────────────────────────
async function devGet<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// ─── Prod mode: one static JSON, filter client-side ─────
interface FleetData {
  months: string[];
  metrics: Record<string, Metrics>;
  allTrips: Trip[];
  intelligence: Record<string, Record<string, unknown>>;
  drivers: Record<string, Record<string, DriverStats>>;
  allDrivers: Record<string, DriverStats>;
  cargo: Record<string, CargoStats[]>;
  allCargo: CargoStats[];
}

let cache: FleetData | null = null;

async function loadData(): Promise<FleetData> {
  if (cache) return cache;
  const res = await fetch("/api/fleet-data.json");
  if (!res.ok) throw new Error("Failed to load fleet data");
  cache = await res.json();
  return cache!;
}

// ─── Unified API ────────────────────────────────────────
export const api = {
  getMonths: async (): Promise<string[]> => {
    if (isDev) return devGet("/months");
    return (await loadData()).months;
  },

  getAllMetrics: async (): Promise<Record<string, Metrics>> => {
    if (isDev) return devGet("/metrics");
    return (await loadData()).metrics;
  },

  getMetrics: async (month: string): Promise<Metrics> => {
    if (isDev) return devGet(`/metrics/${month}`);
    return (await loadData()).metrics[month];
  },

  getTrips: async (params?: Record<string, string>): Promise<Trip[]> => {
    if (isDev) {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return devGet(`/trips${qs}`);
    }
    const data = await loadData();
    let trips = [...data.allTrips];
    if (params?.month) trips = trips.filter((t) => t.month === params.month);
    if (params?.truck) trips = trips.filter((t) => t.truck === params.truck);
    if (params?.driver) trips = trips.filter((t) => t.driver === params.driver);
    if (params?.tier) trips = trips.filter((t) => t.tier === params.tier);
    trips.sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") || b.tripNum - a.tripNum,
    );
    return trips;
  },

  getDrivers: async (month: string): Promise<Record<string, DriverStats>> => {
    if (isDev) return devGet(`/drivers/${month}`);
    return (await loadData()).drivers[month];
  },

  getAllDrivers: async (): Promise<Record<string, DriverStats>> => {
    if (isDev) return devGet("/drivers");
    return (await loadData()).allDrivers;
  },

  getCargo: async (month: string): Promise<CargoStats[]> => {
    if (isDev) return devGet(`/cargo/${month}`);
    return (await loadData()).cargo[month];
  },

  getAllCargo: async (): Promise<CargoStats[]> => {
    if (isDev) return devGet("/cargo");
    return (await loadData()).allCargo;
  },

  getCostStructure: async (month: string): Promise<CostStructure> => {
    if (isDev) return devGet(`/cost-structure/${month}`);
    const intel = (await loadData()).intelligence[month];
    return intel?.costStructure as CostStructure;
  },

  getIntelligence: async (month: string): Promise<Record<string, unknown>> => {
    if (isDev) return devGet(`/intelligence/${month}`);
    return (await loadData()).intelligence[month];
  },

  reload: async () => {
    if (isDev)
      return devGet<{ ok: boolean; trips: number; months: string[] }>(
        "/reload",
      );
    cache = null;
    return { ok: true, trips: 0, months: [] as string[] };
  },
};
