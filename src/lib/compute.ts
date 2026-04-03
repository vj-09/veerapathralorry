import type {
  Trip,
  Metrics,
  DriverStats,
  CargoStats,
  CostStructure,
} from "./types";

export const EMI = 131570;
export const EMI_PER_DAY = Math.round(EMI / 30);

const TIER_THRESHOLDS = [
  { min: 5000, tier: "A" },
  { min: 3000, tier: "B" },
  { min: 2000, tier: "C" },
  { min: 1000, tier: "D" },
] as const;

export function getTier(perDay: number): string {
  for (const t of TIER_THRESHOLDS) if (perDay >= t.min) return t.tier;
  return "F";
}

// ─── Billing cycles (7th → 6th) ─────────────────────────
export interface Cycle {
  label: string;
  from: string;
  to: string;
}

export function generateCycles(trips: Trip[]): Cycle[] {
  const dates = trips
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  if (!dates.length) return [];

  const first = new Date(dates[0] + "T00:00:00");
  const last = new Date(dates[dates.length - 1] + "T00:00:00");

  let start = new Date(first.getFullYear(), first.getMonth(), 7);
  if (start > first) start.setMonth(start.getMonth() - 1);

  const cycles: Cycle[] = [];
  while (start <= last) {
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(6);

    const mo = start.toLocaleString("en-IN", { month: "short" });
    const mo2 = end.toLocaleString("en-IN", { month: "short" });
    cycles.push({
      label: `${mo} ${start.getDate()} – ${mo2} ${end.getDate()}`,
      from: fmt(start),
      to: fmt(end),
    });

    const next = new Date(end);
    next.setDate(7);
    start = next;
  }
  return cycles;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function filterByDateRange(
  trips: Trip[],
  from: string,
  to: string,
): Trip[] {
  return trips.filter((t) => t.date && t.date >= from && t.date <= to);
}

function prevCycleRange(from: string) {
  const f = new Date(from + "T00:00:00");
  const prevTo = new Date(f.getTime() - 86400000);
  const prevFrom = new Date(f);
  prevFrom.setMonth(prevFrom.getMonth() - 1);
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

// ─── Metrics ─────────────────────────────────────────────
export function computeMetrics(trips: Trip[]): Metrics | null {
  if (!trips.length) return null;
  const dates = trips
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  const minD = new Date(dates[0] + "T00:00:00");
  const maxD = new Date(dates[dates.length - 1] + "T00:00:00");
  const daysInPeriod =
    Math.ceil((maxD.getTime() - minD.getTime()) / 86400000) + 1;

  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  const totalDiesel = trips.reduce((s, t) => s + t.diesel, 0);
  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const totalExpenses = trips.reduce((s, t) => s + t.totalExpenses, 0);
  const fleetPerDay = daysInPeriod > 0 ? totalProfit / daysInPeriod : 0;
  const projected30d = fleetPerDay * 30;

  const tierCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  trips.forEach((t) => {
    if (t.tier && tierCounts[t.tier] !== undefined) tierCounts[t.tier]++;
  });

  return {
    fleetPerDay: Math.round(fleetPerDay),
    emiCoverage: Math.round((projected30d / EMI) * 100) / 100,
    afterEmi: Math.round(projected30d - EMI),
    projected30d: Math.round(projected30d),
    totalRevenue,
    totalDiesel,
    totalExpenses,
    projectedMargin:
      totalRevenue > 0
        ? Math.round((totalProfit / totalRevenue) * 1000) / 10
        : 0,
    dieselPct:
      totalRevenue > 0
        ? Math.round((totalDiesel / totalRevenue) * 1000) / 10
        : 0,
    tripsPerDay:
      daysInPeriod > 0
        ? Math.round((trips.length / daysInPeriod) * 100) / 100
        : 0,
    avgPerTrip: trips.length > 0 ? Math.round(totalProfit / trips.length) : 0,
    tierCounts,
    totalTrips: trips.length,
    totalProfit: Math.round(totalProfit),
    daysInPeriod,
    dateRange: { from: dates[0], to: dates[dates.length - 1] },
  };
}

// ─── Driver Stats ────────────────────────────────────────
export function computeDriverStats(trips: Trip[]): Record<string, DriverStats> {
  const map: Record<string, Trip[]> = {};
  trips.forEach((t) => {
    (map[t.driver] ??= []).push(t);
  });

  const result: Record<string, DriverStats> = {};
  for (const [name, dt] of Object.entries(map)) {
    const rev = dt.reduce((s, t) => s + t.revenue, 0);
    const diesel = dt.reduce((s, t) => s + t.diesel, 0);
    const profit = dt.reduce((s, t) => s + t.trueProfit, 0);
    const km = dt.reduce((s, t) => s + (t.km || 0), 0);
    const ww = dt.filter((t) => t.weight);
    const avgT =
      ww.length > 0
        ? ww.reduce((s, t) => s + (t.weight || 0), 0) / ww.length
        : 0;
    const totalDays = dt.reduce((s, t) => s + (t.calDays || 0), 0);
    result[name] = {
      driver: name,
      truck: dt[0].truck,
      regn: dt[0].regn,
      totalTrips: dt.length,
      totalRevenue: rev,
      totalDiesel: diesel,
      totalKm: km,
      totalProfit: Math.round(profit),
      dieselPerKm: km > 0 ? Math.round((diesel / km) * 10) / 10 : null,
      avgTons: Math.round(avgT * 10) / 10,
      fTierTrips: dt.filter((t) => t.tier === "F").length,
      margin: rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0,
      avgProfitPerTrip: dt.length > 0 ? Math.round(profit / dt.length) : 0,
      avgPerDay: totalDays > 0 ? Math.round(profit / totalDays) : 0,
    };
  }
  return result;
}

// ─── Cargo Stats ─────────────────────────────────────────
export function computeCargoStats(trips: Trip[]): CargoStats[] {
  const map: Record<
    string,
    { cargo: string; trips: number; rev: number; profit: number; days: number }
  > = {};
  trips.forEach((t) => {
    const c = t.cargo || "Unknown";
    const e = (map[c] ??= { cargo: c, trips: 0, rev: 0, profit: 0, days: 0 });
    e.trips++;
    e.rev += t.revenue;
    e.profit += t.trueProfit;
    e.days += t.calDays || 0;
  });
  return Object.values(map)
    .map((c) => ({
      cargo: c.cargo,
      trips: c.trips,
      totalRevenue: c.rev,
      totalProfit: c.profit,
      totalDays: c.days,
      avgRevenue: Math.round(c.rev / c.trips),
      avgProfit: Math.round(c.profit / c.trips),
      margin: c.rev > 0 ? Math.round((c.profit / c.rev) * 1000) / 10 : 0,
      avgPerDay: c.days > 0 ? Math.round(c.profit / c.days) : 0,
    }))
    .sort((a, b) => b.avgPerDay - a.avgPerDay);
}

// ─── Cost Structure ──────────────────────────────────────
export function computeCostStructure(trips: Trip[]): CostStructure | null {
  const rev = trips.reduce((s, t) => s + t.revenue, 0);
  if (!rev) return null;
  const diesel = trips.reduce((s, t) => s + t.diesel, 0);
  const toll = trips.reduce((s, t) => s + t.toll, 0);
  const profit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const hasDetail = trips.some((t) => t.driverPay > 0);
  let dp: number, ld: number, comm: number;
  if (hasDetail) {
    dp = trips.reduce((s, t) => s + t.driverPay, 0);
    ld = trips.reduce((s, t) => s + t.loading + t.unloading, 0);
    comm = trips.reduce((s, t) => s + t.commission, 0);
  } else {
    dp = Math.round(rev * 0.14);
    const exp = trips.reduce((s, t) => s + t.expensesSubtotal, 0);
    const rem = exp - dp;
    ld = Math.round(rem * 0.55);
    comm = Math.round(rem * 0.2);
  }
  const other = rev - diesel - dp - ld - comm - toll - profit;
  const p = (v: number) => Math.round((v / rev) * 1000) / 10;
  return {
    diesel: p(diesel),
    driverPay: p(dp),
    loading: p(ld),
    toll: p(toll),
    commission: p(comm),
    other: p(Math.max(0, other)),
    profit: p(profit),
    estimated: !hasDetail,
  };
}

// ─── Intelligence ────────────────────────────────────────
export interface DailyPoint {
  date: string;
  label: string;
  dayProfit: number;
  trips: number;
  cumProfit: number;
  runningAvg: number;
  target: number;
  daysElapsed: number;
}
export interface PaceData {
  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;
  totalProfit: number;
  currentPace: number;
  recentPace: number;
  targetPace: number;
  pctComplete: number;
  projected: number;
  afterEmi: number;
  momentum: number;
  currentTrajectory: number;
  strongFinish: number;
  bestCase: number;
  worstCase: number;
  tripsPerDay: number;
  tripsNeededForEmi: number;
}
export interface Insight {
  severity: string;
  icon: string;
  title: string;
  detail: string;
  impact: string;
}
export interface Action {
  priority: number;
  effort: string;
  title: string;
  detail: string;
  impact: string;
}
export interface GapData {
  driver: string;
  trips: number;
  gaps: { days: number }[];
  idleDays: number;
  avgGap: number;
  maxGap: number;
  trend: number[];
  trendDir: string;
}
export interface RouteData {
  route: string;
  count: number;
  avgPerDay: number;
  avgProfit: number;
  avgRevenue: number;
  margin: number;
  tiers: (string | null)[];
}

export function computeDailyTimeline(trips: Trip[]): DailyPoint[] {
  const sorted = trips
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];
  const startDate = new Date(sorted[0].date + "T00:00:00");
  const endDate = new Date(sorted[sorted.length - 1].date + "T00:00:00");
  const timeline: DailyPoint[] = [];
  let cumProfit = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const ds = fmt(cur);
    const dt = sorted.filter((t) => t.date === ds);
    const dp = dt.reduce((s, t) => s + t.trueProfit, 0);
    cumProfit += dp;
    const elapsed =
      Math.ceil((cur.getTime() - startDate.getTime()) / 86400000) + 1;
    timeline.push({
      date: ds,
      label: cur.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      dayProfit: Math.round(dp),
      trips: dt.length,
      cumProfit: Math.round(cumProfit),
      runningAvg: Math.round(cumProfit / elapsed),
      target: EMI_PER_DAY,
      daysElapsed: elapsed,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return timeline;
}

export function computePace(
  trips: Trip[],
  dateFrom: string,
  dateTo: string,
): PaceData | null {
  const sorted = trips
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;
  const fromD = new Date(dateFrom + "T00:00:00");
  const toD = new Date(dateTo + "T00:00:00");
  const daysInCycle =
    Math.ceil((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  const startDate = new Date(sorted[0].date + "T00:00:00");
  const endDate = new Date(sorted[sorted.length - 1].date + "T00:00:00");
  const daysElapsed =
    Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const daysRemaining = Math.max(0, daysInCycle - daysElapsed);
  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const pace = daysElapsed > 0 ? totalProfit / daysElapsed : 0;

  const sevenAgo = new Date(endDate);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const recent = sorted.filter(
    (t) => new Date(t.date + "T00:00:00") >= sevenAgo,
  );
  const recentPace =
    recent.length > 0
      ? recent.reduce((s, t) => s + t.trueProfit, 0) / Math.min(7, daysElapsed)
      : pace;

  const mid = Math.floor(sorted.length / 2);
  const f1 = sorted.slice(0, mid);
  const f2 = sorted.slice(mid);
  const a1 =
    f1.length > 0 ? f1.reduce((s, t) => s + t.trueProfit, 0) / f1.length : 0;
  const a2 =
    f2.length > 0 ? f2.reduce((s, t) => s + t.trueProfit, 0) / f2.length : 0;
  const momentum = a1 > 0 ? ((a2 - a1) / a1) * 100 : 0;
  const projected = pace * daysInCycle;

  return {
    daysElapsed,
    daysRemaining,
    daysInMonth: daysInCycle,
    totalProfit: Math.round(totalProfit),
    currentPace: Math.round(pace),
    recentPace: Math.round(recentPace),
    targetPace: Math.round(EMI / daysInCycle),
    pctComplete: Math.round((daysElapsed / daysInCycle) * 100),
    projected: Math.round(projected),
    afterEmi: Math.round(projected - EMI),
    momentum: Math.round(momentum),
    currentTrajectory: Math.round(totalProfit + daysRemaining * pace),
    strongFinish: Math.round(
      totalProfit + daysRemaining * Math.max(pace, recentPace) * 1.15,
    ),
    bestCase: Math.round(totalProfit + daysRemaining * pace * 1.4),
    worstCase: Math.round(totalProfit + daysRemaining * pace * 0.6),
    tripsPerDay:
      daysElapsed > 0
        ? Math.round((trips.length / daysElapsed) * 100) / 100
        : 0,
    tripsNeededForEmi:
      pace > 0 && trips.length > 0
        ? Math.ceil((EMI - totalProfit) / (totalProfit / trips.length))
        : 99,
  };
}

export function computeGapAnalysis(trips: Trip[]): Record<string, GapData> {
  const map: Record<string, Trip[]> = {};
  trips
    .filter((t) => t.date)
    .forEach((t) => {
      (map[t.driver] ??= []).push(t);
    });
  const result: Record<string, GapData> = {};
  for (const [driver, dt] of Object.entries(map)) {
    const sorted = dt.sort((a, b) => a.date.localeCompare(b.date));
    const gaps: { days: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.ceil(
        (new Date(sorted[i].date + "T00:00:00").getTime() -
          new Date(sorted[i - 1].date + "T00:00:00").getTime()) /
          86400000,
      );
      gaps.push({ days });
    }
    const idle = gaps.reduce((s, g) => s + Math.max(0, g.days - 1), 0);
    const avg =
      gaps.length > 0 ? gaps.reduce((s, g) => s + g.days, 0) / gaps.length : 0;
    const trend =
      gaps.length >= 3
        ? gaps.slice(-3).map((g) => g.days)
        : gaps.map((g) => g.days);
    const dir =
      trend.length >= 2
        ? trend[trend.length - 1] < trend[0]
          ? "improving"
          : trend[trend.length - 1] > trend[0]
            ? "worsening"
            : "stable"
        : "stable";
    result[driver] = {
      driver,
      trips: sorted.length,
      gaps,
      idleDays: idle,
      avgGap: Math.round(avg * 10) / 10,
      maxGap: gaps.length > 0 ? Math.max(...gaps.map((g) => g.days)) : 0,
      trend,
      trendDir: dir,
    };
  }
  return result;
}

export function computeRouteStats(trips: Trip[]): RouteData[] {
  const map: Record<string, Trip[]> = {};
  trips
    .filter((t) => t.from && t.to)
    .forEach((t) => {
      (map[`${t.from}→${t.to}`] ??= []).push(t);
    });
  return Object.entries(map)
    .map(([route, rt]) => {
      const profit = rt.reduce((s, t) => s + t.trueProfit, 0);
      const rev = rt.reduce((s, t) => s + t.revenue, 0);
      const days = rt.reduce((s, t) => s + (t.calDays || 0), 0);
      return {
        route,
        count: rt.length,
        avgPerDay: days > 0 ? Math.round(profit / days) : 0,
        avgProfit: Math.round(profit / rt.length),
        avgRevenue: Math.round(rev / rt.length),
        margin: rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0,
        tiers: rt.map((t) => t.tier),
      };
    })
    .sort((a, b) => b.avgPerDay - a.avgPerDay);
}

export function generateInsights(trips: Trip[], prevTrips: Trip[]): Insight[] {
  const ins: Insight[] = [];
  if (!trips.length) return ins;
  const rev = trips.reduce((s, t) => s + t.revenue, 0);
  const profit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const diesel = trips.reduce((s, t) => s + t.diesel, 0);
  const dp = rev > 0 ? (diesel / rev) * 100 : 0;
  const margin = rev > 0 ? (profit / rev) * 100 : 0;
  const pRev = prevTrips.reduce((s, t) => s + t.revenue, 0);
  const pProfit = prevTrips.reduce((s, t) => s + t.trueProfit, 0);
  const pDiesel = prevTrips.reduce((s, t) => s + t.diesel, 0);
  const pDp = pRev > 0 ? (pDiesel / pRev) * 100 : 0;
  const pMargin = pRev > 0 ? (pProfit / pRev) * 100 : 0;

  // F-tier
  const fT = trips.filter((t) => t.tier === "F");
  if (fT.length > 0) {
    const byD: Record<string, number> = {};
    fT.forEach((t) => {
      byD[t.driver] = (byD[t.driver] || 0) + 1;
    });
    const lost = fT.reduce(
      (s, t) => s + Math.max(0, 2000 - (t.perDay || 0)) * (t.calDays || 1),
      0,
    );
    ins.push({
      severity: "red",
      icon: "🔴",
      title: `${fT.length} F-tier trips`,
      detail: Object.entries(byD)
        .map(([d, c]) => `${d}: ${c}`)
        .join(", "),
      impact: `₹${Math.round(lost).toLocaleString("en-IN")} lost vs C-tier baseline`,
    });
  }
  // A-tier drought
  const aT = trips.filter((t) => t.tier === "A");
  const sorted = trips
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (aT.length === 0 && trips.length >= 5) {
    ins.push({
      severity: "amber",
      icon: "🟡",
      title: "Zero A-tier trips",
      detail: "No trip hit ₹5,000+/day.",
      impact: "A single A-tier trip adds ₹5K-15K profit",
    });
  } else if (aT.length > 0) {
    const lastA = aT.sort((a, b) => b.date.localeCompare(a.date))[0];
    const lastDate = sorted[sorted.length - 1]?.date;
    if (lastA && lastDate) {
      const d = Math.ceil(
        (new Date(lastDate).getTime() - new Date(lastA.date).getTime()) /
          86400000,
      );
      if (d > 5)
        ins.push({
          severity: "amber",
          icon: "🟡",
          title: `${d}d since last A-tier`,
          detail: `Last: ${lastA.from}→${lastA.to}`,
          impact: "Premium load drought",
        });
    }
  }
  // Diesel
  if (prevTrips.length > 0 && pDp > 0) {
    const ch = dp - pDp;
    if (Math.abs(ch) > 0.5) {
      const sv = Math.round((Math.abs(ch) / 100) * rev);
      ins.push({
        severity: ch < 0 ? "green" : "red",
        icon: ch < 0 ? "🟢" : "🔴",
        title: `Diesel ${ch < 0 ? "improved" : "worsened"} ${Math.abs(ch).toFixed(1)}pp`,
        detail: `${dp.toFixed(1)}% (was ${pDp.toFixed(1)}%)`,
        impact: `${ch < 0 ? "Saving" : "Losing"} ~₹${sv.toLocaleString("en-IN")}`,
      });
    }
  }
  // Margin
  if (prevTrips.length > 0 && pMargin > 0) {
    const d = margin - pMargin;
    if (Math.abs(d) > 1) {
      const g = Math.round((Math.abs(d) / 100) * rev);
      ins.push({
        severity: d > 0 ? "green" : "red",
        icon: d > 0 ? "🟢" : "🔴",
        title: `Margin ${d > 0 ? "expanded" : "compressed"} ${Math.abs(d).toFixed(1)}pp`,
        detail: `${margin.toFixed(1)}% (was ${pMargin.toFixed(1)}%)`,
        impact: `₹${g.toLocaleString("en-IN")} ${d > 0 ? "gain" : "gap"}`,
      });
    }
  }
  // Overloading
  const heavy = trips.filter((t) => t.weight && t.weight >= 30 && t.perDay > 0);
  const light = trips.filter(
    (t) => t.weight && t.weight > 0 && t.weight < 25 && t.perDay > 0,
  );
  if (heavy.length >= 2 && light.length >= 2) {
    const ha = heavy.reduce((s, t) => s + t.perDay, 0) / heavy.length;
    const la = light.reduce((s, t) => s + t.perDay, 0) / light.length;
    if (ha > la)
      ins.push({
        severity: "green",
        icon: "📦",
        title: `Overloading earns ₹${Math.round(ha - la).toLocaleString("en-IN")}/day more`,
        detail: `≥30T avg ₹${Math.round(ha)}/day vs <25T avg ₹${Math.round(la)}/day`,
        impact: "Push for full loads",
      });
  }
  // Break-even
  const be = trips.filter((t) => t.revenue < 18181);
  if (be.length > 0)
    ins.push({
      severity: "red",
      icon: "⚠️",
      title: `${be.length} trips below ₹18,181 break-even`,
      detail: be
        .map((t) => `T${t.tripNum} ₹${t.revenue.toLocaleString("en-IN")}`)
        .join(", "),
      impact: "Guaranteed loss. Reject these loads.",
    });
  // Concentration
  const cm: Record<string, number> = {};
  trips.forEach((t) => {
    cm[t.cargo] = (cm[t.cargo] || 0) + 1;
  });
  const top = Object.entries(cm).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] / trips.length > 0.5)
    ins.push({
      severity: "amber",
      icon: "🟡",
      title: `${Math.round((top[1] / trips.length) * 100)}% from "${top[0]}"`,
      detail: `${top[1]}/${trips.length} trips. Single-cargo risk.`,
      impact: "Rate cuts in this cargo = fleet-wide hit",
    });
  // Zero F-tier driver
  const dm: Record<string, { t: number; f: number }> = {};
  trips.forEach((t) => {
    const e = (dm[t.driver] ??= { t: 0, f: 0 });
    e.t++;
    if (t.tier === "F") e.f++;
  });
  for (const [d, s] of Object.entries(dm))
    if (s.t >= 5 && s.f === 0)
      ins.push({
        severity: "green",
        icon: "⭐",
        title: `${d}: ${s.t} trips, ZERO F-tier`,
        detail: "Consistent margin specialist.",
        impact: "Model this behavior",
      });
  // Momentum
  if (sorted.length >= 6) {
    const m = Math.floor(sorted.length / 2);
    const a1 = sorted.slice(0, m).reduce((s, t) => s + t.trueProfit, 0) / m;
    const a2 =
      sorted.slice(m).reduce((s, t) => s + t.trueProfit, 0) /
      (sorted.length - m);
    const p = a1 > 0 ? ((a2 - a1) / a1) * 100 : 0;
    if (Math.abs(p) > 15)
      ins.push({
        severity: p > 0 ? "green" : "red",
        icon: p > 0 ? "📈" : "📉",
        title: `Fleet ${p > 0 ? "accelerating" : "decelerating"} ${Math.abs(p).toFixed(0)}%`,
        detail: `1st half ₹${Math.round(a1)}/trip → 2nd half ₹${Math.round(a2)}/trip`,
        impact: p > 0 ? "Sustain momentum" : "Investigate: rates or gaps?",
      });
  }

  const order: Record<string, number> = { red: 0, amber: 1, green: 2 };
  ins.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  return ins;
}

export function generateActions(trips: Trip[], prevTrips: Trip[]): Action[] {
  const actions: Action[] = [];
  if (!trips.length) return actions;
  const profit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const avgPPT = profit / trips.length;

  // Load factor
  const ww = trips.filter((t) => t.weight && t.weight > 0);
  if (ww.length > 0) {
    const avg = ww.reduce((s, t) => s + (t.weight || 0), 0) / ww.length;
    const lf = avg / 27.5;
    if (lf < 0.92) {
      const g = Math.round(
        ((0.95 - lf) * 27.5 * 850 * trips.length) / ww.length,
      );
      actions.push({
        priority: 1,
        effort: "Low",
        title: `Push loads from ${Math.round(lf * 100)}% to 95%`,
        detail: `Avg ${avg.toFixed(1)}T on 27.5T capacity. Wait for full truck.`,
        impact: `+₹${Math.max(0, g).toLocaleString("en-IN")}/month`,
      });
    }
  }
  // F-tier
  const fT = trips.filter((t) => t.tier === "F");
  if (fT.length > 0) {
    const fa = fT.reduce((s, t) => s + t.trueProfit, 0) / fT.length;
    const g = Math.round((2500 - fa) * fT.length);
    actions.push({
      priority: 2,
      effort: "Medium",
      title: `Convert ${fT.length} F-tier trips to C-tier`,
      detail:
        "Phone formula: (Revenue - ₹17,500) ÷ Days. Below ₹2,000 → reject.",
      impact: `+₹${Math.max(0, g).toLocaleString("en-IN")}/month`,
    });
  }
  // Gap days
  const gaps = computeGapAnalysis(trips);
  const idle = Object.values(gaps).reduce((s, g) => s + g.idleDays, 0);
  if (idle > 5)
    actions.push({
      priority: 3,
      effort: "Low",
      title: `Recover ${idle} idle days`,
      detail: `Each idle day ≈ ₹${Math.round(avgPPT / 2).toLocaleString("en-IN")} lost. Pre-book return loads.`,
      impact: `+₹${Math.round((idle * avgPPT) / 3).toLocaleString("en-IN")}/month`,
    });
  // Backhaul
  actions.push({
    priority: 4,
    effort: "Low",
    title: "Book 2 backhaul trips/month",
    detail: "Even a C-tier backhaul beats empty return.",
    impact: `+₹${Math.round(avgPPT * 2).toLocaleString("en-IN")}/month`,
  });
  // EMI
  const projected = avgPPT * (trips.length + 5);
  if (projected < EMI) {
    const d = EMI - projected;
    const n = Math.ceil(d / avgPPT);
    actions.push({
      priority: 0,
      effort: "High",
      title: `Need ${n} more profitable trips for EMI`,
      detail: `Projected ₹${Math.round(projected).toLocaleString("en-IN")} vs EMI ₹${EMI.toLocaleString("en-IN")}`,
      impact: "EMI coverage = survival",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

// ─── Full intelligence bundle ────────────────────────────
export interface Intelligence {
  daily: DailyPoint[];
  pace: PaceData | null;
  insights: Insight[];
  actions: Action[];
  gaps: Record<string, GapData>;
  routes: RouteData[];
  costStructure: CostStructure | null;
  cargo: CargoStats[];
}

const EMPTY_INTEL: Intelligence = {
  daily: [],
  pace: null,
  insights: [],
  actions: [],
  gaps: {},
  routes: [],
  costStructure: null,
  cargo: [],
};

export function computeIntelligence(
  allTrips: Trip[],
  dateFrom: string,
  dateTo: string,
): Intelligence {
  if (!dateFrom || !dateTo || !allTrips.length) return EMPTY_INTEL;
  const trips = filterByDateRange(allTrips, dateFrom, dateTo);
  if (!trips.length) return EMPTY_INTEL;
  const prev = prevCycleRange(dateFrom);
  const prevTrips = filterByDateRange(allTrips, prev.from, prev.to);
  return {
    daily: computeDailyTimeline(trips),
    pace: computePace(trips, dateFrom, dateTo),
    insights: generateInsights(trips, prevTrips),
    actions: generateActions(trips, prevTrips),
    gaps: computeGapAnalysis(trips),
    routes: computeRouteStats(trips),
    costStructure: computeCostStructure(trips),
    cargo: computeCargoStats(trips),
  };
}
