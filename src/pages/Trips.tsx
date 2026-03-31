import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtInr, fmtDate, monthLabel, tierBadge } from "../lib/format";
import type { Trip } from "../lib/types";
import { ArrowUpDown } from "lucide-react";

type SortKey =
  | "date"
  | "revenue"
  | "diesel"
  | "trueProfit"
  | "perDay"
  | "calDays";

export default function Trips() {
  const [months, setMonths] = useState<string[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [month, setMonth] = useState("all");
  const [truck, setTruck] = useState("all");
  const [driver, setDriver] = useState("all");
  const [tier, setTier] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getMonths()
      .then(setMonths)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (month !== "all") params.month = month;
    if (truck !== "all") params.truck = truck;
    if (driver !== "all") params.driver = driver;
    if (tier !== "all") params.tier = tier;
    api
      .getTrips(params)
      .then(setTrips)
      .catch((e) => setError(e.message));
  }, [month, truck, driver, tier]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...trips].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = (a.date || "").localeCompare(b.date || "");
    else cmp = (a[sortKey] || 0) - (b[sortKey] || 0);
    return sortAsc ? cmp : -cmp;
  });

  const totals = {
    revenue: trips.reduce((s, t) => s + t.revenue, 0),
    diesel: trips.reduce((s, t) => s + t.diesel, 0),
    profit: trips.reduce((s, t) => s + t.trueProfit, 0),
  };

  if (error) return <div className="p-8 text-red-400">{error}</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-100">Trip Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="all">All Months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={truck}
          onChange={(e) => setTruck(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="all">All Trucks</option>
          <option value="T1">T1 (Kumar)</option>
          <option value="T2">T2 (Senthil)</option>
        </select>
        <select
          value={driver}
          onChange={(e) => setDriver(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="all">All Drivers</option>
          <option value="Kumar">Kumar</option>
          <option value="Senthil">Senthil</option>
        </select>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="all">All Tiers</option>
          {["A", "B", "C", "D", "F"].map((t) => (
            <option key={t} value={t}>
              {tierBadge(t).emoji} {t}-Tier
            </option>
          ))}
        </select>
        <div className="ml-auto text-sm text-slate-500 self-center">
          {trips.length} trips
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-3 py-3 text-left">#</th>
              <th
                className="px-3 py-3 text-left cursor-pointer"
                onClick={() => toggleSort("date")}
              >
                <span className="flex items-center gap-1">
                  Date <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="px-3 py-3 text-left">Truck</th>
              <th className="px-3 py-3 text-left hidden md:table-cell">
                Route
              </th>
              <th className="px-3 py-3 text-left hidden lg:table-cell">
                Cargo
              </th>
              <th
                className="px-3 py-3 text-right cursor-pointer"
                onClick={() => toggleSort("revenue")}
              >
                <span className="flex items-center justify-end gap-1">
                  Revenue <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                className="px-3 py-3 text-right cursor-pointer hidden md:table-cell"
                onClick={() => toggleSort("diesel")}
              >
                <span className="flex items-center justify-end gap-1">
                  Diesel <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                className="px-3 py-3 text-right cursor-pointer"
                onClick={() => toggleSort("trueProfit")}
              >
                <span className="flex items-center justify-end gap-1">
                  Profit <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                className="px-3 py-3 text-right cursor-pointer"
                onClick={() => toggleSort("calDays")}
              >
                <span className="flex items-center justify-end gap-1">
                  Days <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                className="px-3 py-3 text-right cursor-pointer"
                onClick={() => toggleSort("perDay")}
              >
                <span className="flex items-center justify-end gap-1">
                  ₹/Day <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="px-3 py-3 text-center">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sorted.map((t, i) => {
              const tb = tierBadge(t.tier);
              return (
                <tr
                  key={`${t.source}-${t.tripNum}-${i}`}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-3 py-2.5 text-slate-500">{t.tripNum}</td>
                  <td className="px-3 py-2.5 text-slate-300">
                    {fmtDate(t.date)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-slate-400">{t.truck}</span>
                    <span className="text-slate-600 text-xs ml-1">
                      {t.driver}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 hidden md:table-cell max-w-48 truncate">
                    {t.from} → {t.to}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 hidden lg:table-cell truncate max-w-28">
                    {t.cargo}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-300">
                    {fmtInr(t.revenue)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400 hidden md:table-cell">
                    {fmtInr(t.diesel)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-medium ${t.trueProfit >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {fmtInr(t.trueProfit)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400">
                    {t.calDays || "-"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-medium ${tb.color}`}
                  >
                    {t.perDay ? fmtInr(t.perDay) : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${tb.bg} ${tb.color} border ${tb.border}`}
                    >
                      {tb.emoji} {tb.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {trips.length > 0 && (
            <tfoot>
              <tr className="bg-slate-800/80 font-semibold text-slate-200">
                <td
                  colSpan={5}
                  className="px-3 py-3 text-left hidden md:table-cell"
                >
                  TOTALS
                </td>
                <td colSpan={3} className="px-3 py-3 text-left md:hidden">
                  TOTALS
                </td>
                <td className="px-3 py-3 text-right">
                  {fmtInr(totals.revenue)}
                </td>
                <td className="px-3 py-3 text-right hidden md:table-cell">
                  {fmtInr(totals.diesel)}
                </td>
                <td
                  className={`px-3 py-3 text-right ${totals.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {fmtInr(totals.profit)}
                </td>
                <td className="px-3 py-3 text-right text-slate-400">-</td>
                <td className="px-3 py-3 text-right text-slate-400">-</td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!trips.length && (
        <div className="text-center py-12 text-slate-500">
          No trips found. Check your filters.
        </div>
      )}
    </div>
  );
}
