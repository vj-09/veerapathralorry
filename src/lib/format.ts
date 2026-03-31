export function fmtInr(val: number): string {
  if (val == null) return "-";
  const abs = Math.abs(val);
  const prefix = val < 0 ? "-" : "";
  return (
    prefix + "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })
  );
}

export function fmtInrShort(val: number): string {
  if (val == null) return "-";
  const abs = Math.abs(val);
  const prefix = val < 0 ? "-" : "";
  if (abs >= 100000) return prefix + "₹" + (abs / 100000).toFixed(1) + "L";
  if (abs >= 1000) return prefix + "₹" + (abs / 1000).toFixed(1) + "K";
  return prefix + "₹" + abs;
}

export function fmtPct(val: number): string {
  return val.toFixed(1) + "%";
}

export function fmtChange(
  current: number,
  previous: number | null | undefined,
) {
  if (!previous) return { text: "-", positive: true, pct: 0 };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return {
    text: (pct > 0 ? "+" : "") + pct.toFixed(0) + "%",
    positive: pct >= 0,
    pct,
  };
}

export function fmtDate(date: string): string {
  if (!date) return "-";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function monthLabel(month: string): string {
  if (!month) return "-";
  const [year, m] = month.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[parseInt(m) - 1] + " " + year;
}

export const TIER = {
  A: {
    label: "A",
    emoji: "⭐",
    color: "text-amber-400",
    bg: "bg-amber-400/15",
    border: "border-amber-400/30",
  },
  B: {
    label: "B",
    emoji: "🟢",
    color: "text-green-400",
    bg: "bg-green-400/15",
    border: "border-green-400/30",
  },
  C: {
    label: "C",
    emoji: "🟡",
    color: "text-yellow-400",
    bg: "bg-yellow-400/15",
    border: "border-yellow-400/30",
  },
  D: {
    label: "D",
    emoji: "🟠",
    color: "text-orange-400",
    bg: "bg-orange-400/15",
    border: "border-orange-400/30",
  },
  F: {
    label: "F",
    emoji: "🔴",
    color: "text-red-400",
    bg: "bg-red-400/15",
    border: "border-red-400/30",
  },
} as Record<
  string,
  { label: string; emoji: string; color: string; bg: string; border: string }
>;

const PENDING_TIER = {
  label: "-",
  emoji: "⏳",
  color: "text-slate-500",
  bg: "bg-slate-500/15",
  border: "border-slate-500/30",
};

export function tierBadge(tier: string | null) {
  if (!tier) return PENDING_TIER;
  return TIER[tier] || PENDING_TIER;
}
