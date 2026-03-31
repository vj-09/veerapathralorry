import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtInr, fmtPct, monthLabel, tierBadge } from "../lib/format";
import type { DriverStats, Trip } from "../lib/types";
import { Truck, Fuel, Award, AlertTriangle } from "lucide-react";

export default function Drivers() {
  const [months, setMonths] = useState<string[]>([]);
  const [selected, setSelected] = useState("all");
  const [drivers, setDrivers] = useState<Record<string, DriverStats>>({});
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getMonths()
      .then((m) => {
        setMonths(m);
        if (m.length) setSelected(m[m.length - 1]);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const driverReq =
      selected === "all" ? api.getAllDrivers() : api.getDrivers(selected);
    const tripParams = selected === "all" ? {} : { month: selected };
    Promise.all([driverReq, api.getTrips(tripParams)])
      .then(([d, t]) => {
        setDrivers(d);
        setTrips(t);
      })
      .catch((e) => setError(e.message));
  }, [selected]);

  if (error) return <div className="p-8 text-red-400">{error}</div>;

  const kumar = drivers["Kumar"];
  const senthil = drivers["Senthil"];

  if (!kumar && !senthil)
    return <div className="p-8 text-slate-500">Loading...</div>;

  const driverList = [kumar, senthil].filter(Boolean) as DriverStats[];

  // F-tier bounce analysis
  const senthilTrips = trips
    .filter((t) => t.driver === "Senthil")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const bounces: { fTrip: Trip; nextTrip: Trip | null }[] = [];
  for (let i = 0; i < senthilTrips.length; i++) {
    if (senthilTrips[i].tier === "F" && i + 1 < senthilTrips.length) {
      bounces.push({ fTrip: senthilTrips[i], nextTrip: senthilTrips[i + 1] });
    }
  }

  function StatRow({
    label,
    values,
    fmt,
    highlight,
  }: {
    label: string;
    values: (number | null | undefined)[];
    fmt?: (v: number) => string;
    highlight?: "higher" | "lower";
  }) {
    const format = fmt || ((v: number) => String(v));
    const nums = values.filter((v) => v != null) as number[];
    const best = highlight === "lower" ? Math.min(...nums) : Math.max(...nums);
    return (
      <tr className="border-b border-slate-800/30">
        <td className="py-2.5 px-3 text-slate-400 text-sm">{label}</td>
        {values.map((v, i) => (
          <td
            key={i}
            className={`py-2.5 px-3 text-right text-sm font-medium ${
              highlight && v === best ? "text-green-400" : "text-slate-300"
            }`}
          >
            {v != null ? format(v) : "-"}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Driver Comparison</h1>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="all">All Time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Driver Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {driverList.map((d) => (
          <div
            key={d.driver}
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Truck size={20} className="text-slate-400" />
              </div>
              <div>
                <div className="font-bold text-slate-200">{d.driver}</div>
                <div className="text-xs text-slate-500">
                  {d.truck} &middot; {d.regn}
                </div>
              </div>
              {d.fTierTrips === 0 && (
                <span className="ml-auto flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                  <Award size={12} /> Zero F-tier
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-slate-500">Trips</div>
                <div className="text-lg font-bold text-slate-200">
                  {d.totalTrips}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Revenue</div>
                <div className="text-lg font-bold text-slate-200">
                  {fmtInr(d.totalRevenue)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">TRUE Profit</div>
                <div
                  className={`text-lg font-bold ${d.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {fmtInr(d.totalProfit)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Margin</div>
                <div className="text-lg font-bold text-slate-200">
                  {fmtPct(d.margin)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Avg ₹/Day</div>
                <div className="text-lg font-bold text-slate-200">
                  {fmtInr(d.avgPerDay)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">F-Tier Trips</div>
                <div
                  className={`text-lg font-bold ${d.fTierTrips > 0 ? "text-red-400" : "text-green-400"}`}
                >
                  {d.fTierTrips}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      {kumar && senthil && (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/80">
                <th className="py-3 px-3 text-left text-xs text-slate-400 uppercase">
                  Metric
                </th>
                <th className="py-3 px-3 text-right text-xs text-slate-400 uppercase">
                  Kumar T1
                </th>
                <th className="py-3 px-3 text-right text-xs text-slate-400 uppercase">
                  Senthil T2
                </th>
              </tr>
            </thead>
            <tbody>
              <StatRow
                label="Trips"
                values={[kumar.totalTrips, senthil.totalTrips]}
                highlight="higher"
              />
              <StatRow
                label="Revenue"
                values={[kumar.totalRevenue, senthil.totalRevenue]}
                fmt={fmtInr}
                highlight="higher"
              />
              <StatRow
                label="TRUE Profit"
                values={[kumar.totalProfit, senthil.totalProfit]}
                fmt={fmtInr}
                highlight="higher"
              />
              <StatRow
                label="Margin"
                values={[kumar.margin, senthil.margin]}
                fmt={(v) => fmtPct(v)}
                highlight="higher"
              />
              <StatRow
                label="Avg Profit/Trip"
                values={[kumar.avgProfitPerTrip, senthil.avgProfitPerTrip]}
                fmt={fmtInr}
                highlight="higher"
              />
              <StatRow
                label="Avg ₹/Day"
                values={[kumar.avgPerDay, senthil.avgPerDay]}
                fmt={fmtInr}
                highlight="higher"
              />
              <StatRow
                label="Diesel"
                values={[kumar.totalDiesel, senthil.totalDiesel]}
                fmt={fmtInr}
                highlight="lower"
              />
              {kumar.dieselPerKm && senthil.dieselPerKm && (
                <StatRow
                  label="₹/km (Diesel)"
                  values={[kumar.dieselPerKm, senthil.dieselPerKm]}
                  fmt={(v) => `₹${v.toFixed(1)}`}
                  highlight="lower"
                />
              )}
              <StatRow
                label="Avg Tons/Trip"
                values={[kumar.avgTons, senthil.avgTons]}
                fmt={(v) => v.toFixed(1) + "T"}
                highlight="higher"
              />
              <StatRow
                label="F-Tier Trips"
                values={[kumar.fTierTrips, senthil.fTierTrips]}
                highlight="lower"
              />
            </tbody>
          </table>
        </div>
      )}

      {/* F-Tier Bounce Analysis */}
      {bounces.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-slate-200">
              F-Tier Bounce Analysis (Senthil)
            </span>
          </div>
          <div className="space-y-2">
            {bounces.map((b, i) => {
              const nextTb = b.nextTrip ? tierBadge(b.nextTrip.tier) : null;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm bg-slate-900/40 rounded-lg p-3"
                >
                  <span className="text-red-400 font-medium">
                    {tierBadge("F").emoji} ₹{b.fTrip.perDay}/day
                  </span>
                  <span className="text-slate-600">→</span>
                  {b.nextTrip && nextTb && (
                    <span className={`font-medium ${nextTb.color}`}>
                      {nextTb.emoji} ₹{b.nextTrip.perDay}/day ({nextTb.label})
                    </span>
                  )}
                  <span className="text-green-400 ml-auto text-xs">
                    +₹
                    {(
                      (b.nextTrip?.perDay || 0) - b.fTrip.perDay
                    ).toLocaleString("en-IN")}{" "}
                    bounce
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {
              bounces.filter(
                (b) => b.nextTrip && ["A", "B"].includes(b.nextTrip.tier),
              ).length
            }
            /{bounces.length} bounced to A/B tier. But waiting 1 day + C-tier
            load still beats F-trip + bounce mathematically.
          </div>
        </div>
      )}
    </div>
  );
}
