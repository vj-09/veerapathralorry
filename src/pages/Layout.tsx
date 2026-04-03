import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  Users,
  BarChart3,
  MapPin,
  Map,
  Calendar,
} from "lucide-react";
import { useFleet } from "../lib/FleetContext";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/trips", icon: Truck, label: "Trips" },
  { to: "/drivers", icon: Users, label: "Drivers" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/map", icon: Map, label: "Map" },
];

function DateFilter() {
  const { cycles, dateFrom, dateTo, setDateRange, filteredTrips } = useFleet();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
        <Calendar size={12} /> Billing Cycle
      </div>
      {/* Cycle presets */}
      <div className="space-y-0.5">
        {cycles.map((c) => (
          <button
            key={c.from}
            onClick={() => setDateRange(c.from, c.to)}
            className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
              dateFrom === c.from && dateTo === c.to
                ? "bg-orange-500/15 text-orange-400 font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => {
            const dates =
              cycles.length > 0
                ? { from: cycles[0].from, to: cycles[cycles.length - 1].to }
                : { from: "", to: "" };
            setDateRange(dates.from, dates.to);
          }}
          className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
            cycles.length > 0 &&
            dateFrom === cycles[0]?.from &&
            dateTo === cycles[cycles.length - 1]?.to
              ? "bg-orange-500/15 text-orange-400 font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
          }`}
        >
          All Time
        </button>
      </div>
      {/* Custom range */}
      <div className="space-y-1 pt-1 border-t border-slate-700/30">
        <label className="text-[10px] text-slate-500">Custom range</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateRange(e.target.value, dateTo)}
          className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-300 text-xs rounded px-2 py-1.5"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateRange(dateFrom, e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-300 text-xs rounded px-2 py-1.5"
        />
      </div>
      <div className="text-[10px] text-slate-600 text-center">
        {filteredTrips.length} trips in range
      </div>
    </div>
  );
}

function MobileDateFilter() {
  const { cycles, dateFrom, dateTo, setDateRange, filteredTrips } = useFleet();

  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-2 bg-slate-800/60 border-b border-slate-700/30 -mx-4 scrollbar-hide">
      {cycles.map((c) => (
        <button
          key={c.from}
          onClick={() => setDateRange(c.from, c.to)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
            dateFrom === c.from && dateTo === c.to
              ? "bg-orange-500/20 text-orange-400 font-medium border border-orange-500/30"
              : "bg-slate-800 text-slate-400 border border-slate-700/50"
          }`}
        >
          {c.label}
        </button>
      ))}
      <button
        onClick={() => {
          if (cycles.length > 0)
            setDateRange(cycles[0].from, cycles[cycles.length - 1].to);
        }}
        className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
          cycles.length > 0 &&
          dateFrom === cycles[0]?.from &&
          dateTo === cycles[cycles.length - 1]?.to
            ? "bg-orange-500/20 text-orange-400 font-medium border border-orange-500/30"
            : "bg-slate-800 text-slate-400 border border-slate-700/50"
        }`}
      >
        All
      </button>
      <span className="shrink-0 text-[10px] text-slate-600 self-center ml-1">
        {filteredTrips.length} trips
      </span>
    </div>
  );
}

export default function Layout() {
  const { loading, error } = useFleet();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        Loading fleet data...
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-red-400">
        Failed: {error}. Is the server running?
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-800/80 border-r border-slate-700/50 fixed inset-y-0 left-0 z-20">
        <div className="p-4 border-b border-slate-700/50">
          <h1 className="text-lg font-bold text-orange-500 tracking-tight">
            VPT Fleet
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Intelligence Dashboard
          </p>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-orange-500/10 text-orange-400 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="p-3 border-t border-slate-700/50">
          <DateFilter />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56 pb-20 md:pb-0 min-h-screen">
        {/* Mobile date filter pills */}
        <div className="md:hidden">
          <MobileDateFilter />
        </div>
        <Outlet />
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700/50 flex z-20">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 text-[10px] transition-colors ${
                isActive ? "text-orange-400" : "text-slate-500"
              }`
            }
          >
            <Icon size={20} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
