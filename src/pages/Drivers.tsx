import { useFleet } from "../lib/FleetContext";
import { fmtInr, fmtPct, tierBadge } from "../lib/format";
import type { DriverStats } from "../lib/types";
import { Truck, Award, AlertTriangle } from "lucide-react";

export default function Drivers() {
  const { driverStats: drivers, filteredTrips: trips } = useFleet();

  const kumar = drivers["Kumar"];
  const senthil = drivers["Senthil"];
  const driverList = [kumar, senthil].filter(Boolean) as DriverStats[];

  if (!driverList.length)
    return (
      <div className="p-8 text-slate-500">No driver data in this range.</div>
    );

  // F-tier bounce analysis
  const senthilTrips = trips
    .filter((t) => t.driver === "Senthil")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const bounces: {
    fTrip: (typeof trips)[0];
    nextTrip: (typeof trips)[0] | null;
  }[] = [];
  for (let i = 0; i < senthilTrips.length; i++) {
    if (senthilTrips[i].tier === "F" && i + 1 < senthilTrips.length) {
      bounces.push({ fTrip: senthilTrips[i], nextTrip: senthilTrips[i + 1] });
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Driver Comparison</h1>

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

      {/* Comparison */}
      {kumar &&
        senthil &&
        (() => {
          const rows = [
            {
              label: "Trips",
              k: kumar.totalTrips,
              s: senthil.totalTrips,
              fmt: String,
              hi: "higher" as const,
            },
            {
              label: "Revenue",
              k: kumar.totalRevenue,
              s: senthil.totalRevenue,
              fmt: fmtInr,
              hi: "higher" as const,
            },
            {
              label: "TRUE Profit",
              k: kumar.totalProfit,
              s: senthil.totalProfit,
              fmt: fmtInr,
              hi: "higher" as const,
            },
            {
              label: "Margin",
              k: kumar.margin,
              s: senthil.margin,
              fmt: (v: number) => fmtPct(v),
              hi: "higher" as const,
            },
            {
              label: "Avg ₹/Day",
              k: kumar.avgPerDay,
              s: senthil.avgPerDay,
              fmt: fmtInr,
              hi: "higher" as const,
            },
            {
              label: "Avg Profit/Trip",
              k: kumar.avgProfitPerTrip,
              s: senthil.avgProfitPerTrip,
              fmt: fmtInr,
              hi: "higher" as const,
            },
            {
              label: "Diesel",
              k: kumar.totalDiesel,
              s: senthil.totalDiesel,
              fmt: fmtInr,
              hi: "lower" as const,
            },
            {
              label: "Avg Tons",
              k: kumar.avgTons,
              s: senthil.avgTons,
              fmt: (v: number) => v.toFixed(1) + "T",
              hi: "higher" as const,
            },
            {
              label: "F-Tier",
              k: kumar.fTierTrips,
              s: senthil.fTierTrips,
              fmt: String,
              hi: "lower" as const,
            },
          ];
          return (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {rows.map((r) => {
                  const best =
                    r.hi === "lower" ? Math.min(r.k, r.s) : Math.max(r.k, r.s);
                  return (
                    <div
                      key={r.label}
                      className="flex items-center bg-slate-800/40 rounded-lg px-4 py-3"
                    >
                      <span className="text-xs text-slate-400 w-28 shrink-0">
                        {r.label}
                      </span>
                      <div className="flex-1 flex justify-around">
                        <span
                          className={`text-sm font-medium ${r.k === best ? "text-green-400" : "text-slate-300"}`}
                        >
                          {r.fmt(r.k)}
                        </span>
                        <span className="text-slate-600 text-xs">vs</span>
                        <span
                          className={`text-sm font-medium ${r.s === best ? "text-green-400" : "text-slate-300"}`}
                        >
                          {r.fmt(r.s)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-around text-[10px] text-slate-500 px-4">
                  <span className="ml-28">Kumar</span>
                  <span>Senthil</span>
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden md:block rounded-xl border border-slate-700/50 overflow-hidden">
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
                    {rows.map((r) => {
                      const best =
                        r.hi === "lower"
                          ? Math.min(r.k, r.s)
                          : Math.max(r.k, r.s);
                      return (
                        <tr
                          key={r.label}
                          className="border-b border-slate-800/30"
                        >
                          <td className="py-2.5 px-3 text-slate-400 text-sm">
                            {r.label}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right text-sm font-medium ${r.k === best ? "text-green-400" : "text-slate-300"}`}
                          >
                            {r.fmt(r.k)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right text-sm font-medium ${r.s === best ? "text-green-400" : "text-slate-300"}`}
                          >
                            {r.fmt(r.s)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

      {/* F-Tier Bounce */}
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
              const ntb = b.nextTrip ? tierBadge(b.nextTrip.tier) : null;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm bg-slate-900/40 rounded-lg p-3"
                >
                  <span className="text-red-400 font-medium">
                    {tierBadge("F").emoji} ₹{b.fTrip.perDay}/day
                  </span>
                  <span className="text-slate-600">→</span>
                  {b.nextTrip && ntb && (
                    <span className={`font-medium ${ntb.color}`}>
                      {ntb.emoji} ₹{b.nextTrip.perDay}/day ({ntb.label})
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
            /{bounces.length} bounced to A/B. But waiting 1 day + C-tier still
            beats F-trip + bounce.
          </div>
        </div>
      )}
    </div>
  );
}
