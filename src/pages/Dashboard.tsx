import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtInr, fmtPct, fmtChange, monthLabel, TIER } from "../lib/format";
import type { Metrics } from "../lib/types";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Fuel,
  Target,
  Calculator,
} from "lucide-react";

const EMI = 131570;
const EMI_PER_DAY = Math.round(EMI / 30);

export default function Dashboard() {
  const [months, setMonths] = useState<string[]>([]);
  const [allMetrics, setAllMetrics] = useState<Record<string, Metrics>>({});
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getMonths(), api.getAllMetrics()])
      .then(([m, metrics]) => {
        setMonths(m);
        setAllMetrics(metrics);
        if (m.length) setSelected(m[m.length - 1]);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="p-8 text-red-400">
        Failed to load: {error}. Make sure the server is running (npm run
        server).
      </div>
    );
  if (!selected)
    return <div className="p-8 text-slate-500">Loading dashboard...</div>;

  const cur = allMetrics[selected];
  const prevIdx = months.indexOf(selected) - 1;
  const prev = prevIdx >= 0 ? allMetrics[months[prevIdx]] : null;

  if (!cur)
    return <div className="p-8 text-slate-500">No data for {selected}</div>;

  const metrics = [
    {
      label: "Fleet ₹/Day",
      value: fmtInr(cur.fleetPerDay),
      raw: cur.fleetPerDay,
      prevRaw: prev?.fleetPerDay,
      target: `Target: ₹${EMI_PER_DAY.toLocaleString("en-IN")}+`,
      good: cur.fleetPerDay >= EMI_PER_DAY,
    },
    {
      label: "EMI Coverage (30d)",
      value: cur.emiCoverage.toFixed(2) + "x",
      raw: cur.emiCoverage,
      prevRaw: prev?.emiCoverage,
      target: "Target: ≥1.0x",
      good: cur.emiCoverage >= 1,
    },
    {
      label: "After EMI (30d)",
      value: fmtInr(cur.afterEmi),
      raw: cur.afterEmi,
      prevRaw: prev?.afterEmi,
      target: "Target: ₹50K+ buffer",
      good: cur.afterEmi >= 0,
    },
    {
      label: "Projected Profit (30d)",
      value: fmtInr(cur.projected30d),
      raw: cur.projected30d,
      prevRaw: prev?.projected30d,
      target: "Target: ≥₹1.5L",
      good: cur.projected30d >= 150000,
    },
    {
      label: "Revenue",
      value: fmtInr(cur.totalRevenue),
      raw: cur.totalRevenue,
      prevRaw: prev?.totalRevenue,
      target: `${cur.totalTrips} trips / ${cur.daysInPeriod}d`,
      good: true,
    },
    {
      label: "Projected Margin",
      value: fmtPct(cur.projectedMargin),
      raw: cur.projectedMargin,
      prevRaw: prev?.projectedMargin,
      target: "Target: ≥22%",
      good: cur.projectedMargin >= 22,
    },
    {
      label: "Diesel % of Revenue",
      value: fmtPct(cur.dieselPct),
      raw: cur.dieselPct,
      prevRaw: prev?.dieselPct,
      target: "Target: ≤40%",
      good: cur.dieselPct <= 40,
      lowerBetter: true,
    },
    {
      label: "Trips/Day",
      value: cur.tripsPerDay.toFixed(2),
      raw: cur.tripsPerDay,
      prevRaw: prev?.tripsPerDay,
      target: "Target: ≥0.80",
      good: cur.tripsPerDay >= 0.8,
    },
    {
      label: "Avg ₹/Trip",
      value: fmtInr(cur.avgPerTrip),
      raw: cur.avgPerTrip,
      prevRaw: prev?.avgPerTrip,
      target: "Target: ≥₹6,500",
      good: cur.avgPerTrip >= 6500,
    },
  ];

  const tierData = Object.entries(cur.tierCounts).map(([tier, count]) => ({
    tier,
    count,
    ...TIER[tier],
  }));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Fleet Intelligence
          </h1>
          <p className="text-xs text-slate-500">
            {cur.dateRange.from &&
              `${cur.daysInPeriod} days (${cur.dateRange.from} to ${cur.dateRange.to})`}
          </p>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 w-40"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* North Star Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((m) => {
          const change = fmtChange(m.raw, m.prevRaw);
          const changePositive = m.lowerBetter
            ? !change.positive
            : change.positive;
          return (
            <div
              key={m.label}
              className={`rounded-xl border p-3.5 transition-colors ${
                m.good
                  ? "bg-slate-800/60 border-slate-700/50"
                  : "bg-red-950/20 border-red-900/30"
              }`}
            >
              <div className="text-[11px] text-slate-500 mb-1.5 truncate">
                {m.label}
              </div>
              <div
                className={`text-lg font-bold ${m.good ? "text-slate-100" : "text-red-300"}`}
              >
                {m.value}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {prev && change.text !== "-" && (
                  <span
                    className={`text-xs flex items-center gap-0.5 ${
                      changePositive ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {changePositive ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                    {change.text}
                  </span>
                )}
                <span className="text-[10px] text-slate-600 truncate">
                  {m.target}
                </span>
              </div>
            </div>
          );
        })}

        {/* Tier Split */}
        <div className="rounded-xl border bg-slate-800/60 border-slate-700/50 p-3.5">
          <div className="text-[11px] text-slate-500 mb-1.5">Tier Split</div>
          <div className="flex gap-1.5 mt-1">
            {tierData.map((t) => (
              <div
                key={t.tier}
                className={`flex-1 text-center rounded-md py-1.5 ${t.bg} border ${t.border}`}
              >
                <div className={`text-xs font-bold ${t.color}`}>{t.count}</div>
                <div className="text-[9px] text-slate-500">{t.emoji}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-600 mt-1.5">
            Target: 0 F-tier
          </div>
        </div>
      </div>

      {/* EMI Coverage Bar */}
      <div className="rounded-xl border bg-slate-800/60 border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-300">
            EMI Coverage
          </span>
          <span
            className={`ml-auto text-sm font-bold ${cur.emiCoverage >= 1 ? "text-green-400" : "text-red-400"}`}
          >
            {cur.emiCoverage.toFixed(2)}x
          </span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${
              cur.emiCoverage >= 1.5
                ? "bg-green-500"
                : cur.emiCoverage >= 1
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
            style={{
              width: `${Math.min(100, (cur.emiCoverage / 2) * 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>0x</span>
          <span className="text-amber-500">1.0x EMI</span>
          <span className="text-green-500">1.5x Target</span>
          <span>2.0x</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div>
            <div className="text-[10px] text-slate-500">EMI/Month</div>
            <div className="text-sm font-semibold text-slate-300">
              {fmtInr(EMI)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">Projected (30d)</div>
            <div className="text-sm font-semibold text-slate-300">
              {fmtInr(cur.projected30d)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">After EMI</div>
            <div
              className={`text-sm font-semibold ${cur.afterEmi >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {fmtInr(cur.afterEmi)}
            </div>
          </div>
        </div>
      </div>

      {/* The One Number */}
      <div className="rounded-xl border-2 border-orange-500/30 bg-orange-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Target size={18} className="text-orange-400" />
          <span className="text-sm font-bold text-orange-400 uppercase tracking-wide">
            The One Number
          </span>
        </div>
        <div className="text-3xl font-black text-orange-400">
          ₹{EMI_PER_DAY.toLocaleString("en-IN")}
          <span className="text-base font-medium text-orange-400/60 ml-1">
            per day
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg p-3">
            <Calculator size={14} className="text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-500">Formula</div>
              <div className="text-slate-300 text-xs">
                (Revenue - ₹17,500) / Days
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <TrendingUp size={14} className="text-green-400" />
            <div>
              <div className="text-[10px] text-green-400/60">
                &gt; ₹{EMI_PER_DAY.toLocaleString("en-IN")}
              </div>
              <div className="text-green-300 text-xs font-medium">TAKE IT</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <Fuel size={14} className="text-red-400" />
            <div>
              <div className="text-[10px] text-red-400/60">&lt; ₹2,000</div>
              <div className="text-red-300 text-xs font-medium">REJECT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
