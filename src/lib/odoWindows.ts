/**
 * Odometer Window Mapping
 * Maps GPS points to trips by odometer reading.
 * Every point inside a window = belongs to that trip.
 * Points outside = unknown.
 */

export interface OdoWindow {
  label: string;
  odoStart: number;
  odoEnd: number;
  from: string;
  to: string;
  cargo: string;
  revenue: number;
}

// Senthil T2 — continuous chain, S4–S9
const SENTHIL: OdoWindow[] = [
  {
    label: "S4",
    odoStart: 18853,
    odoEnd: 19242,
    from: "Idappadi",
    to: "Madurai Kovil",
    cargo: "Jowar",
    revenue: 25000,
  },
  {
    label: "S5",
    odoStart: 19242,
    odoEnd: 19804,
    from: "Velankanni",
    to: "Mannachanallur",
    cargo: "கோடிம்",
    revenue: 30000,
  },
  {
    label: "S6",
    odoStart: 19804,
    odoEnd: 20189,
    from: "(verify)",
    to: "(verify)",
    cargo: "சோளம்",
    revenue: 17850,
  },
  {
    label: "S7",
    odoStart: 20189,
    odoEnd: 20559,
    from: "Kangayam",
    to: "Mannachanallur",
    cargo: "Jowar",
    revenue: 34650,
  },
  {
    label: "S8",
    odoStart: 20559,
    odoEnd: 20913,
    from: "(verify)",
    to: "(verify)",
    cargo: "நெல்",
    revenue: 23460,
  },
  {
    label: "S9",
    odoStart: 20913,
    odoEnd: 21425,
    from: "Mannachanallur",
    to: "Madurai area",
    cargo: "நெல்",
    revenue: 23700,
  },
];

// Kumar T1 — partial
const KUMAR: OdoWindow[] = [
  {
    label: "K3",
    odoStart: 22789,
    odoEnd: 23002,
    from: "Idappadi",
    to: "Devakottai",
    cargo: "Jowar",
    revenue: 26950,
  },
  {
    label: "K4",
    odoStart: 23002,
    odoEnd: 23424,
    from: "Idappadi",
    to: "Tiruchirappalli",
    cargo: "Jowar",
    revenue: 27000,
  },
  {
    label: "K5",
    odoStart: 23424,
    odoEnd: 23974,
    from: "Dharapuram",
    to: "Ponnachi",
    cargo: "Jowar",
    revenue: 33300,
  },
  {
    label: "K6",
    odoStart: 23974,
    odoEnd: 24320,
    from: "Madathukulam",
    to: "Thondaipadi",
    cargo: "Sand",
    revenue: 23630,
  },
  {
    label: "K7",
    odoStart: 24320,
    odoEnd: 24745,
    from: "Idappadi",
    to: "Varannatchi",
    cargo: "Jowar",
    revenue: 30600,
  },
  {
    label: "K8",
    odoStart: 24745,
    odoEnd: 25146,
    from: "Amaindhipparandalayam",
    to: "Isainarduppu",
    cargo: "Paddy",
    revenue: 21250,
  },
];

export function getWindows(driver: string): OdoWindow[] {
  return driver === "Senthil" ? SENTHIL : KUMAR;
}

// 20 distinct colors — max contrast, easy to tell apart on dark map
const TRIP_PALETTE = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
  "#a3e635", // lime
  "#6366f1", // indigo
  "#d946ef", // fuchsia
  "#0ea5e9", // sky
  "#84cc16", // yellow-green
  "#e879f9", // purple-pink
  "#2dd4bf", // emerald
  "#fb923c", // light orange
  "#818cf8", // periwinkle
  "#34d399", // mint
  "#fbbf24", // gold
];

function tripColor(index: number): string {
  return TRIP_PALETTE[index % TRIP_PALETTE.length];
}

export function getTripColors(driver: string): Record<string, string> {
  const windows = getWindows(driver);
  const colors: Record<string, string> = {};
  windows.forEach((w, i) => {
    colors[w.label] = tripColor(i);
  });
  return colors;
}

export interface MappedPoint {
  lat: number;
  lng: number;
  ts: string;
  s: number | null;
  f?: number;
  o?: number;
  st: string;
  a?: string;
  v?: string;
  trip: string | null; // "S4", "S5"... or null
  window: OdoWindow | null;
}

export function mapPointsToTrips(
  points: {
    lat: number;
    lng: number;
    ts: string;
    s: number | null;
    f?: number;
    o?: number;
    st: string;
    a?: string;
    v?: string;
  }[],
  driver: string,
): MappedPoint[] {
  const windows = getWindows(driver);
  return points.map((p) => {
    if (!p.o || p.o <= 0 || !windows.length) {
      return { ...p, trip: null, window: null };
    }
    for (const w of windows) {
      if (p.o >= w.odoStart && p.o <= w.odoEnd) {
        return { ...p, trip: w.label, window: w };
      }
    }
    return { ...p, trip: null, window: null };
  });
}
