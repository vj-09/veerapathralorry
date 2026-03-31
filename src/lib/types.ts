export interface Trip {
  month: string;
  tripNum: number;
  date: string;
  truck: string;
  driver: string;
  regn: string;
  from: string;
  to: string;
  cargo: string;
  weight: number | null;
  rate: number | null;
  unit: string | null;
  km: number | null;
  revenue: number;
  commission: number;
  loading: number;
  unloading: number;
  driverPay: number;
  expensesSubtotal: number;
  diesel: number;
  totalExpenses: number;
  toll: number;
  ownerComm: number;
  trueProfit: number;
  trueMargin: number;
  calDays: number;
  perDay: number;
  tier: string;
  notes: string;
}

export interface Metrics {
  fleetPerDay: number;
  emiCoverage: number;
  afterEmi: number;
  projected30d: number;
  totalRevenue: number;
  projectedMargin: number;
  dieselPct: number;
  tripsPerDay: number;
  avgPerTrip: number;
  tierCounts: Record<string, number>;
  totalTrips: number;
  totalDiesel: number;
  totalProfit: number;
  totalExpenses: number;
  daysInPeriod: number;
  dateRange: { from: string; to: string };
}

export interface DriverStats {
  driver: string;
  truck: string;
  regn: string;
  totalTrips: number;
  totalRevenue: number;
  totalDiesel: number;
  totalProfit: number;
  totalKm: number;
  dieselPerKm: number | null;
  avgTons: number;
  fTierTrips: number;
  margin: number;
  avgProfitPerTrip: number;
  avgPerDay: number;
}

export interface CargoStats {
  cargo: string;
  trips: number;
  totalRevenue: number;
  totalProfit: number;
  totalDays: number;
  avgRevenue: number;
  avgProfit: number;
  margin: number;
  avgPerDay: number;
}

export interface CostStructure {
  diesel: number;
  driverPay: number;
  loading: number;
  toll: number;
  commission: number;
  other: number;
  profit: number;
  estimated: boolean;
}
