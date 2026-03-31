import type {
  Trip,
  Metrics,
  DriverStats,
  CargoStats,
  CostStructure,
} from "./types";

const BASE = "http://localhost:3002/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  getMonths: () => get<string[]>("/months"),
  getAllMetrics: () => get<Record<string, Metrics>>("/metrics"),
  getMetrics: (month: string) => get<Metrics>(`/metrics/${month}`),
  getTrips: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return get<Trip[]>(`/trips${qs}`);
  },
  getDrivers: (month: string) =>
    get<Record<string, DriverStats>>(`/drivers/${month}`),
  getAllDrivers: () => get<Record<string, DriverStats>>("/drivers"),
  getCargo: (month: string) => get<CargoStats[]>(`/cargo/${month}`),
  getAllCargo: () => get<CargoStats[]>("/cargo"),
  getCostStructure: (month: string) =>
    get<CostStructure>(`/cost-structure/${month}`),
  getIntelligence: (month: string) =>
    get<Record<string, unknown>>(`/intelligence/${month}`),
  reload: () =>
    get<{ ok: boolean; trips: number; months: string[] }>("/reload"),
};
