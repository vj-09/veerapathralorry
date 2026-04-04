import { useMemo } from "react";
import { useFleet } from "../lib/FleetContext";
import { fmtInr, fmtPct, tierBadge } from "../lib/format";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Route,
  Gauge,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const EMI = 131570;
const EMI_PER_DAY = Math.round(EMI / 30);

const SEVERITY_STYLES: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  red: {
    bg: "bg-red-500/8",
    border: "border-red-500/20",
    icon: "text-red-400",
  },
  amber: {
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    icon: "text-amber-400",
  },
  green: {
    bg: "bg-green-500/8",
    border: "border-green-500/20",
    icon: "text-green-400",
  },
};

export default function Analytics() {
  const { intelligence: intel, dateFrom, dateTo, filteredTrips } = useFleet();

  if (!filteredTrips.length)
    return (
      <div className="p-8 text-slate-500">No trips in this date range.</div>
    );

  const { daily, pace, insights, actions, gaps, routes, costStructure, cargo } =
    intel as any;

  // ─── Deep Driver Metrics ───────────────────────────────
  const driverDeep = useMemo(() => {
    const calc = (driver: string) => {
      const trips = filteredTrips.filter(
        (t) => t.driver === driver && t.perDay > 0,
      );
      if (!trips.length) return null;
      const totalRev = trips.reduce((s, t) => s + t.revenue, 0);
      const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
      const totalKm = trips.reduce((s, t) => s + (t.km || 0), 0);
      const totalTons = trips
        .filter((t) => t.weight)
        .reduce((s, t) => s + (t.weight || 0), 0);
      const totalDiesel = trips.reduce((s, t) => s + t.diesel, 0);
      const totalDays = trips.reduce((s, t) => s + (t.calDays || 1), 0);
      const perDayValues = trips.map((t) => t.perDay);
      const mean =
        perDayValues.reduce((s, v) => s + v, 0) / perDayValues.length;
      const variance =
        perDayValues.reduce((s, v) => s + (v - mean) ** 2, 0) /
        perDayValues.length;
      const stdDev = Math.round(Math.sqrt(variance));
      return {
        driver,
        trips: trips.length,
        revPerKm: totalKm > 0 ? Math.round(totalRev / totalKm) : 0,
        profitPerTon: totalTons > 0 ? Math.round(totalProfit / totalTons) : 0,
        profitPerDay: totalDays > 0 ? Math.round(totalProfit / totalDays) : 0,
        avgLoadTons:
          totalTons > 0
            ? Math.round(
                (totalTons / trips.filter((t) => t.weight).length) * 10,
              ) / 10
            : 0,
        tripsCount: trips.length,
        dieselPerKm:
          totalKm > 0 ? Math.round((totalDiesel / totalKm) * 10) / 10 : 0,
        fTier: trips.filter((t) => t.tier === "F").length,
        mean: Math.round(mean),
        stdDev,
        cv: mean > 0 ? Math.round((stdDev / mean) * 100) : 0, // coefficient of variation %
        perDayValues: trips.map((t) => ({
          trip: "T" + t.tripNum,
          perDay: t.perDay,
          tier: t.tier,
        })),
        minPerDay: Math.min(...perDayValues),
        maxPerDay: Math.max(...perDayValues),
      };
    };
    return { kumar: calc("Kumar"), senthil: calc("Senthil") };
  }, [filteredTrips]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Fleet Intelligence</h1>
        <p className="text-xs text-slate-500">
          {dateFrom} to {dateTo} &middot; {filteredTrips.length} trips &middot;
          CEO-level insights
        </p>
      </div>

      {/* ━━━ REVENUE PULSE ━━━ */}
      <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-orange-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
            Revenue Pulse
          </h2>
          <span className="ml-auto text-xs text-slate-500">
            Running avg ₹/day vs EMI target
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Green = above EMI burn rate (₹{EMI_PER_DAY.toLocaleString("en-IN")}
          /day). Red = below.
        </p>

        {daily && daily.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={daily}
              margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="aboveLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#f1f5f9" }}
                formatter={(value: number, name: string) => [
                  `₹${value.toLocaleString("en-IN")}`,
                  name === "runningAvg" ? "Running Avg ₹/Day" : name,
                ]}
              />
              <ReferenceLine
                y={EMI_PER_DAY}
                stroke="#f97316"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{
                  value: `₹${EMI_PER_DAY} EMI`,
                  fill: "#f97316",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Area
                type="monotone"
                dataKey="runningAvg"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#aboveLine)"
                dot={{ r: 3, fill: "#22c55e" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ━━━ PACE TRACKER ━━━ */}
      {pace && (
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={16} className="text-blue-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              Pace Tracker
            </h2>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Month progress</span>
              <span>
                {pace.daysElapsed}d of {pace.daysInMonth}d ({pace.pctComplete}%)
              </span>
            </div>
            <div className="w-full bg-slate-700/40 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${pace.pctComplete}%` }}
              />
            </div>
          </div>

          {/* Key numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-900/40 rounded-lg p-3">
              <div className="text-[10px] text-slate-500">Current Pace</div>
              <div
                className={`text-xl font-black ${pace.currentPace >= pace.targetPace ? "text-green-400" : "text-red-400"}`}
              >
                {fmtInr(pace.currentPace)}
                <span className="text-xs font-normal text-slate-500">/day</span>
              </div>
            </div>
            <div className="bg-slate-900/40 rounded-lg p-3">
              <div className="text-[10px] text-slate-500">Target Pace</div>
              <div className="text-xl font-black text-orange-400">
                {fmtInr(pace.targetPace)}
                <span className="text-xs font-normal text-slate-500">/day</span>
              </div>
            </div>
            <div className="bg-slate-900/40 rounded-lg p-3">
              <div className="text-[10px] text-slate-500">Recent 7d Pace</div>
              <div
                className={`text-xl font-black ${pace.recentPace >= pace.targetPace ? "text-green-400" : "text-red-400"}`}
              >
                {fmtInr(pace.recentPace)}
                <span className="text-xs font-normal text-slate-500">/day</span>
              </div>
            </div>
            <div className="bg-slate-900/40 rounded-lg p-3">
              <div className="text-[10px] text-slate-500">Momentum</div>
              <div
                className={`text-xl font-black flex items-center gap-1 ${pace.momentum >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {pace.momentum >= 0 ? (
                  <TrendingUp size={18} />
                ) : (
                  <TrendingDown size={18} />
                )}
                {pace.momentum > 0 ? "+" : ""}
                {pace.momentum}%
              </div>
            </div>
          </div>

          {/* Projection scenarios */}
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Month-End Projections ({pace.daysRemaining}d remaining)
          </h3>
          <div className="space-y-2">
            {[
              {
                label: "Worst Case",
                value: pace.worstCase,
                color: "bg-red-500",
              },
              {
                label: "Current Trajectory",
                value: pace.currentTrajectory,
                color: "bg-amber-500",
              },
              {
                label: "Strong Finish",
                value: pace.strongFinish,
                color: "bg-blue-500",
              },
              {
                label: "Best Case",
                value: pace.bestCase,
                color: "bg-green-500",
              },
            ].map((s) => {
              const afterEmi = s.value - EMI;
              const pct = Math.min(
                100,
                Math.max(0, (s.value / (EMI * 1.5)) * 100),
              );
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-32 shrink-0">
                    {s.label}
                  </span>
                  <div className="flex-1 bg-slate-700/30 rounded-full h-4 overflow-hidden relative">
                    <div
                      className={`h-4 rounded-full ${s.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                    {/* EMI marker */}
                    <div
                      className="absolute top-0 bottom-0 border-l-2 border-orange-500"
                      style={{ left: `${(EMI / (EMI * 1.5)) * 100}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium w-24 text-right ${afterEmi >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {fmtInr(s.value)}
                  </span>
                  <span
                    className={`text-[10px] w-20 text-right ${afterEmi >= 0 ? "text-green-500/60" : "text-red-500/60"}`}
                  >
                    {afterEmi >= 0 ? "+" : ""}
                    {fmtInr(afterEmi)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-orange-500/60 flex items-center gap-1">
            <div className="w-3 border-t-2 border-orange-500" /> = EMI line (₹
            {EMI.toLocaleString("en-IN")})
          </div>
        </section>
      )}

      {/* ━━━ INSIGHTS ━━━ */}
      {insights && insights.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              Insights & Alerts
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              {insights.length} findings
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins: any, i: number) => {
              const style =
                SEVERITY_STYLES[ins.severity] || SEVERITY_STYLES.amber;
              return (
                <div
                  key={i}
                  className={`rounded-xl border ${style.border} ${style.bg} p-4`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">
                      {ins.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-200">
                        {ins.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {ins.detail}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 italic">
                        {ins.impact}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ━━━ ACTION ITEMS ━━━ */}
      {actions && actions.length > 0 && (
        <section className="rounded-xl border-2 border-orange-500/20 bg-orange-500/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-orange-400" />
            <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wide">
              Action Items
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              Ranked by priority
            </span>
          </div>
          <div className="space-y-3">
            {actions.map((a: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-slate-900/40 rounded-lg p-4"
              >
                <div className="w-7 h-7 rounded-full bg-orange-500/15 text-orange-400 flex items-center justify-center text-sm font-black shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200">
                    {a.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {a.detail}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-green-400">
                    {a.impact}
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      a.effort === "Low"
                        ? "bg-green-500/15 text-green-400"
                        : a.effort === "Medium"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {a.effort} effort
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ━━━ DRIVER GAP ANALYSIS ━━━ */}
      {gaps && Object.keys(gaps).length > 0 && (
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-purple-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              Gap Day Analysis
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              Days between trips per driver
            </span>
          </div>
          <div className="space-y-5">
            {Object.values(gaps).map((g: any) => (
              <div key={g.driver}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-300">
                    {g.driver}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      g.trendDir === "improving"
                        ? "bg-green-500/15 text-green-400"
                        : g.trendDir === "worsening"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-slate-500/15 text-slate-400"
                    }`}
                  >
                    {g.trendDir === "improving"
                      ? "Accelerating"
                      : g.trendDir === "worsening"
                        ? "Slowing"
                        : "Stable"}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">
                    {g.trips} trips &middot; Avg gap: {g.avgGap}d &middot; Idle:{" "}
                    {g.idleDays}d
                  </span>
                </div>
                {/* Trip nodes with gap bars between them */}
                <div className="flex items-center gap-0">
                  {g.gaps.map((gap: any, i: number) => {
                    const color =
                      gap.days <= 2
                        ? "bg-green-500"
                        : gap.days <= 3
                          ? "bg-amber-500"
                          : "bg-red-500";
                    const textColor =
                      gap.days <= 2
                        ? "text-green-400"
                        : gap.days <= 3
                          ? "text-amber-400"
                          : "text-red-400";
                    return (
                      <div key={i} className="flex items-center flex-1 min-w-0">
                        {/* Trip dot */}
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0 z-10" />
                        {/* Gap line */}
                        <div className="flex-1 flex flex-col items-center -mx-0.5">
                          <span
                            className={`text-[9px] font-medium ${textColor}`}
                          >
                            {gap.days}d
                          </span>
                          <div
                            className={`w-full h-1.5 rounded-full ${color}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {/* Last trip dot */}
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0 z-10" />
                </div>
              </div>
            ))}
          </div>
          {Object.values(gaps).some((g: any) => g.idleDays > 3) && (
            <div className="mt-3 text-xs text-amber-400/80 bg-amber-500/5 rounded-lg p-2">
              Each idle day = ~₹
              {Math.round(pace?.currentPace || 3000).toLocaleString(
                "en-IN",
              )}{" "}
              lost revenue. Pre-book return loads to eliminate gaps.
            </div>
          )}
        </section>
      )}

      {/* ━━━ ROUTE INTELLIGENCE ━━━ */}
      {routes && routes.length > 0 && (
        <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Route size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              Route Intelligence
            </h2>
          </div>
          {/* Mobile route cards */}
          <div className="md:hidden space-y-2">
            {routes.slice(0, 8).map((r: any, i: number) => {
              const tb =
                r.avgPerDay >= 5000
                  ? tierBadge("A")
                  : r.avgPerDay >= 3000
                    ? tierBadge("B")
                    : r.avgPerDay >= 2000
                      ? tierBadge("C")
                      : r.avgPerDay >= 1000
                        ? tierBadge("D")
                        : tierBadge("F");
              return (
                <div
                  key={i}
                  className={`rounded-lg border ${tb.border} ${tb.bg} px-3.5 py-3`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm text-slate-300 truncate flex-1">
                      {r.route}
                    </span>
                    <span className={`text-sm font-bold ${tb.color}`}>
                      {fmtInr(r.avgPerDay)}/d
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>
                      {r.count} trip{r.count > 1 ? "s" : ""}
                    </span>
                    <span>Profit {fmtInr(r.avgProfit)}</span>
                    <span>{fmtPct(r.margin)}</span>
                    <span className="ml-auto">
                      {r.tiers.map((t: string, j: number) => (
                        <span key={j}>{tierBadge(t).emoji}</span>
                      ))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop route table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-700/50">
                  <th className="py-2 px-2 text-left">Route</th>
                  <th className="py-2 px-2 text-right">Trips</th>
                  <th className="py-2 px-2 text-right">Avg Revenue</th>
                  <th className="py-2 px-2 text-right">Avg Profit</th>
                  <th className="py-2 px-2 text-right">₹/Day</th>
                  <th className="py-2 px-2 text-right">Margin</th>
                  <th className="py-2 px-2 text-center">Tiers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {routes.slice(0, 10).map((r: any, i: number) => {
                  const tb =
                    r.avgPerDay >= 5000
                      ? tierBadge("A")
                      : r.avgPerDay >= 3000
                        ? tierBadge("B")
                        : r.avgPerDay >= 2000
                          ? tierBadge("C")
                          : r.avgPerDay >= 1000
                            ? tierBadge("D")
                            : tierBadge("F");
                  return (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2 px-2 text-slate-300 max-w-48 truncate">
                        {r.route}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {r.count}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {fmtInr(r.avgRevenue)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-300">
                        {fmtInr(r.avgProfit)}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-medium ${tb.color}`}
                      >
                        {fmtInr(r.avgPerDay)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {fmtPct(r.margin)}
                      </td>
                      <td className="py-2 px-2 text-center text-xs">
                        {r.tiers.map((t: string, j: number) => (
                          <span key={j} className="mr-0.5">
                            {tierBadge(t).emoji}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ━━━ CARGO MIX + COST STRUCTURE ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cargo */}
        {cargo && cargo.length > 0 && (
          <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
            <h3 className="text-sm font-bold text-slate-200 mb-3">
              Cargo Performance
            </h3>
            <ResponsiveContainer width="100%" height={cargo.length * 40 + 30}>
              <BarChart
                data={cargo}
                layout="vertical"
                margin={{ left: 70, right: 10 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                />
                <YAxis
                  type="category"
                  dataKey="cargo"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  width={65}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [
                    `₹${v.toLocaleString("en-IN")}`,
                    "Avg ₹/Day",
                  ]}
                />
                <Bar dataKey="avgPerDay" radius={[0, 4, 4, 0]}>
                  {cargo.map((_: any, i: number) => {
                    const c = cargo[i];
                    const fill =
                      c.avgPerDay >= 3000
                        ? "#22c55e"
                        : c.avgPerDay >= 2000
                          ? "#eab308"
                          : "#ef4444";
                    return <rect key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* Cost Structure */}
        {costStructure && (
          <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
            <h3 className="text-sm font-bold text-slate-200 mb-1">
              Cost per ₹100 Revenue
              {costStructure.estimated && (
                <span className="text-[10px] text-amber-400 ml-1">(est.)</span>
              )}
            </h3>
            <div className="flex rounded-lg overflow-hidden h-7 mt-3 mb-3">
              {[
                {
                  label: "Diesel",
                  value: costStructure.diesel,
                  color: "#ef4444",
                },
                {
                  label: "Driver",
                  value: costStructure.driverPay,
                  color: "#f59e0b",
                },
                {
                  label: "Loading",
                  value: costStructure.loading,
                  color: "#3b82f6",
                },
                { label: "Toll", value: costStructure.toll, color: "#8b5cf6" },
                {
                  label: "Comm",
                  value: costStructure.commission,
                  color: "#ec4899",
                },
                {
                  label: "Other",
                  value: costStructure.other,
                  color: "#64748b",
                },
                {
                  label: "Profit",
                  value: costStructure.profit,
                  color: "#22c55e",
                },
              ].map((d) => (
                <div
                  key={d.label}
                  title={`${d.label}: ₹${d.value}`}
                  style={{ width: `${d.value}%`, backgroundColor: d.color }}
                  className="flex items-center justify-center text-[9px] text-white font-medium min-w-0 truncate px-0.5"
                >
                  {d.value >= 6 && `₹${d.value}`}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {[
                {
                  label: "Diesel",
                  value: costStructure.diesel,
                  color: "#ef4444",
                },
                {
                  label: "Driver Pay",
                  value: costStructure.driverPay,
                  color: "#f59e0b",
                },
                {
                  label: "Loading/Unloading",
                  value: costStructure.loading,
                  color: "#3b82f6",
                },
                { label: "Toll", value: costStructure.toll, color: "#8b5cf6" },
                {
                  label: "Commission",
                  value: costStructure.commission,
                  color: "#ec4899",
                },
                {
                  label: "Other",
                  value: costStructure.other,
                  color: "#64748b",
                },
                {
                  label: "Profit",
                  value: costStructure.profit,
                  color: "#22c55e",
                },
              ].map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-slate-400 flex-1">{d.label}</span>
                  <span className="text-slate-200 font-medium">₹{d.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ━━━ DRIVER DEEP METRICS ━━━ */}
      {driverDeep.kumar &&
        driverDeep.senthil &&
        (() => {
          const k = driverDeep.kumar!;
          const s = driverDeep.senthil!;
          const metrics = [
            {
              label: "₹/km driven",
              k: k.revPerKm,
              s: s.revPerKm,
              fmt: (v: number) => `₹${v}`,
              hi: "higher" as const,
            },
            {
              label: "Profit/ton",
              k: k.profitPerTon,
              s: s.profitPerTon,
              fmt: (v: number) => `₹${v.toLocaleString("en-IN")}`,
              hi: "higher" as const,
            },
            {
              label: "₹/calendar day",
              k: k.profitPerDay,
              s: s.profitPerDay,
              fmt: (v: number) => fmtInr(v),
              hi: "higher" as const,
            },
            {
              label: "Avg load (T)",
              k: k.avgLoadTons,
              s: s.avgLoadTons,
              fmt: (v: number) => `${v}T`,
              hi: "higher" as const,
            },
            {
              label: "Trips",
              k: k.tripsCount,
              s: s.tripsCount,
              fmt: String,
              hi: "higher" as const,
            },
            {
              label: "F-tier trips",
              k: k.fTier,
              s: s.fTier,
              fmt: String,
              hi: "lower" as const,
            },
          ];

          // Consistency chart data
          const chartData: any[] = [];
          const maxLen = Math.max(k.perDayValues.length, s.perDayValues.length);
          for (let i = 0; i < maxLen; i++) {
            chartData.push({
              idx: i + 1,
              kumar: k.perDayValues[i]?.perDay || null,
              senthil: s.perDayValues[i]?.perDay || null,
            });
          }

          return (
            <>
              {/* Section 1: Efficiency Matrix */}
              <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                    Driver Efficiency Matrix
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {metrics.map((m) => {
                    const best =
                      m.hi === "lower"
                        ? Math.min(m.k, m.s)
                        : Math.max(m.k, m.s);
                    const kWin = m.k === best;
                    const sWin = m.s === best;
                    const delta =
                      m.k !== 0
                        ? Math.round(
                            (Math.abs(m.k - m.s) / Math.max(m.k, m.s)) * 100,
                          )
                        : 0;
                    return (
                      <div
                        key={m.label}
                        className="flex items-center bg-slate-900/40 rounded-lg px-4 py-3"
                      >
                        <span className="text-xs text-slate-400 w-28 shrink-0">
                          {m.label}
                        </span>
                        <div className="flex-1 flex items-center justify-around">
                          <span
                            className={`text-sm font-semibold ${kWin ? "text-green-400" : "text-slate-300"}`}
                          >
                            {m.fmt(m.k)}
                          </span>
                          <span className="text-slate-600 text-[10px]">vs</span>
                          <span
                            className={`text-sm font-semibold ${sWin ? "text-green-400" : "text-slate-300"}`}
                          >
                            {m.fmt(m.s)}
                          </span>
                        </div>
                        {delta > 0 && (
                          <span className="text-[10px] text-slate-500 w-10 text-right">
                            +{delta}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-around mt-2 text-[10px] text-slate-500">
                  <span className="ml-28">Kumar T1</span>
                  <span>Senthil T2</span>
                </div>
              </section>

              {/* Section 2: Consistency Score */}
              <section className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                    Consistency Score
                  </span>
                  <span className="text-xs text-slate-500">
                    ₹/day variance across trips
                  </span>
                </div>

                {/* Chart: ₹/day per trip, both drivers */}
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="idx"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      label={{
                        value: "Trip #",
                        fill: "#64748b",
                        fontSize: 10,
                        position: "bottom",
                      }}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        `₹${(v / 1000).toFixed(0)}K`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number, name: string) => [
                        fmtInr(v),
                        name === "kumar" ? "Kumar" : "Senthil",
                      ]}
                    />
                    <ReferenceLine
                      y={4386}
                      stroke="#f97316"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                    <Bar
                      dataKey="kumar"
                      fill="#3b82f6"
                      radius={[3, 3, 0, 0]}
                      name="kumar"
                    />
                    <Bar
                      dataKey="senthil"
                      fill="#f59e0b"
                      radius={[3, 3, 0, 0]}
                      name="senthil"
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-slate-900/40 rounded-lg p-3">
                    <div className="text-xs text-blue-400 font-bold mb-1">
                      Kumar T1
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Avg ₹/day</span>
                      <span className="text-slate-200 font-medium">
                        {fmtInr(k.mean)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Std deviation</span>
                      <span className="text-slate-200">
                        ±{fmtInr(k.stdDev)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Range</span>
                      <span className="text-slate-200">
                        {fmtInr(k.minPerDay)}–{fmtInr(k.maxPerDay)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-400">Volatility</span>
                      <span
                        className={`font-bold ${k.cv < 50 ? "text-green-400" : "text-red-400"}`}
                      >
                        {k.cv}% {k.cv < 50 ? "STABLE" : "VOLATILE"}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg p-3">
                    <div className="text-xs text-amber-400 font-bold mb-1">
                      Senthil T2
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Avg ₹/day</span>
                      <span className="text-slate-200 font-medium">
                        {fmtInr(s.mean)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Std deviation</span>
                      <span className="text-slate-200">
                        ±{fmtInr(s.stdDev)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Range</span>
                      <span className="text-slate-200">
                        {fmtInr(s.minPerDay)}–{fmtInr(s.maxPerDay)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-400">Volatility</span>
                      <span
                        className={`font-bold ${s.cv < 50 ? "text-green-400" : "text-red-400"}`}
                      >
                        {s.cv}% {s.cv < 50 ? "STABLE" : "VOLATILE"}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          );
        })()}

      {/* ━━━ THE DECISION FORMULA (sticky reminder) ━━━ */}
      <section className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="text-center sm:text-left">
          <div className="text-xs text-orange-400/60 uppercase tracking-wider font-bold">
            Quick Decision
          </div>
          <div className="text-lg font-black text-orange-400 mt-1">
            (Revenue - ₹17,500) / Days
          </div>
        </div>
        <div className="flex gap-3 sm:ml-auto">
          <div className="text-center bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
            <div className="text-[10px] text-green-400/60">&gt; ₹4,386</div>
            <div className="text-sm font-bold text-green-400">TAKE</div>
          </div>
          <div className="text-center bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
            <div className="text-[10px] text-amber-400/60">₹2K–4.3K</div>
            <div className="text-sm font-bold text-amber-400">NEGOTIATE</div>
          </div>
          <div className="text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            <div className="text-[10px] text-red-400/60">&lt; ₹2,000</div>
            <div className="text-sm font-bold text-red-400">REJECT</div>
          </div>
        </div>
      </section>
    </div>
  );
}
