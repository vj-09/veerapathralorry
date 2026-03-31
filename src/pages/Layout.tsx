import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Truck, Users, BarChart3 } from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/trips", icon: Truck, label: "Trips" },
  { to: "/drivers", icon: Users, label: "Drivers" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-52 bg-slate-800/80 border-r border-slate-700/50 fixed inset-y-0 left-0 z-20">
        <div className="p-4 border-b border-slate-700/50">
          <h1 className="text-lg font-bold text-orange-500 tracking-tight">
            VPT Fleet
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Intelligence Dashboard
          </p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
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
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700/50">
          <div className="text-[10px] text-slate-600 text-center">
            Veerapathra Transport
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-52 pb-20 md:pb-0 min-h-screen">
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
