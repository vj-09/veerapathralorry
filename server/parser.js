const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const EMI = 131570;
const EMI_PER_DAY = EMI / 30;

// ─── Truck / Driver mapping ─────────────────────────────
const TRUCK_MAP = {
  "tn 49 cs 8764": { truck: "T1", driver: "Kumar", regn: "TN49CS8764" },
  tn49cs8764: { truck: "T1", driver: "Kumar", regn: "TN49CS8764" },
  "tn 4dce 8796": { truck: "T2", driver: "Senthil", regn: "TN49CS8796" },
  tn4dce8796: { truck: "T2", driver: "Senthil", regn: "TN49CS8796" },
  tn49cs8796: { truck: "T2", driver: "Senthil", regn: "TN49CS8796" },
  t1: { truck: "T1", driver: "Kumar", regn: "TN49CS8764" },
  t2: { truck: "T2", driver: "Senthil", regn: "TN49CS8796" },
};

function resolveTruck(raw) {
  return (
    TRUCK_MAP[
      String(raw || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

// ─── Tier classification ─────────────────────────────────
function getTier(perDay) {
  if (!perDay || perDay <= 0) return "F";
  if (perDay >= 5000) return "A";
  if (perDay >= 3000) return "B";
  if (perDay >= 2000) return "C";
  if (perDay >= 1000) return "D";
  return "F";
}

function parseTierString(str) {
  if (!str) return null;
  const s = String(str).trim().toUpperCase();
  for (const t of ["A", "B", "C", "D", "F"]) {
    if (s.includes(t)) return t;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function num(val) {
  if (val == null || val === "" || val === "-") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// Find column index by partial header match
function col(headers, ...candidates) {
  const lower = headers.map((h) =>
    String(h || "")
      .toLowerCase()
      .trim(),
  );
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h.includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ─── Format detection ────────────────────────────────────
function detectFormat(row) {
  if (!row || !Array.isArray(row)) return null;
  const joined = row.map((h) => String(h || "").toLowerCase()).join("|");

  if (
    joined.includes("trip #") &&
    (joined.includes("true profit") || joined.includes("calendar day"))
  )
    return "consolidated";
  if (
    (joined.includes("driver") || joined.includes("tier")) &&
    joined.includes("diesel") &&
    joined.includes("revenue")
  )
    return "triplog";
  if (
    joined.includes("s.no") &&
    (joined.includes("8764") ||
      joined.includes("8796") ||
      joined.includes("tn 4dce") ||
      joined.includes("tn 49"))
  )
    return "pnl";
  return null;
}

function findHeaderRow(data) {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const fmt = detectFormat(data[i]);
    if (fmt) return { rowIndex: i, format: fmt };
  }
  return null;
}

// ─── Parse Feb "Consolidated" format ─────────────────────
function parseConsolidated(data, headerIdx, source) {
  const h = data[headerIdx];
  const trips = [];

  const I = {
    trip: col(h, "trip #"),
    truck: col(h, "truck"),
    date: col(h, "start date"),
    from: col(h, "from"),
    to: col(h, "to"),
    cargo: col(h, "cargo"),
    qty: col(h, "qty"),
    unit: col(h, "unit"),
    rate: col(h, "rate"),
    revenue: col(h, "revenue"),
    commission: col(h, "commission"),
    loading: col(h, "loading"),
    unloading: col(h, "unloading"),
    driverPay: col(h, "driver pay"),
    expSub: col(h, "expenses subtotal"),
    diesel: col(h, "diesel", "fuel"),
    totalExp: col(h, "total expenses"),
    toll: col(h, "toll"),
    ownerComm: col(h, "owner comm"),
    trueProfit: col(h, "true profit"),
    trueMargin: col(h, "true margin"),
    perDay: col(h, "calendar day"),
    notes: col(h, "notes"),
  };

  for (let i = headerIdx + 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const first = String(r[0] || "").toLowerCase();
    if (first === "totals" || first === "total") continue;

    const revenue = num(r[I.revenue]);
    if (!revenue) continue;

    const truckInfo = resolveTruck(r[I.truck]);
    if (!truckInfo) continue;

    const trueProfit = num(r[I.trueProfit]);
    const perDay = num(r[I.perDay]);
    const calDays = perDay > 0 ? Math.round(trueProfit / perDay) : 0;
    const date = parseDate(r[I.date]);
    const unitStr = String(r[I.unit] || "").trim();

    let weight = null;
    if (unitStr.toLowerCase() === "ton") weight = num(r[I.qty]);
    else if (unitStr.toLowerCase() === "bags")
      weight = Math.round(num(r[I.qty]) * 0.05 * 10) / 10;

    trips.push({
      tripNum: num(r[I.trip]),
      date,
      truck: truckInfo.truck,
      driver: truckInfo.driver,
      regn: truckInfo.regn,
      from: String(r[I.from] || ""),
      to: String(r[I.to] || ""),
      cargo: String(r[I.cargo] || ""),
      weight,
      rate: num(r[I.rate]) || null,
      unit: unitStr || null,
      km: null,
      revenue,
      commission: num(r[I.commission]),
      loading: num(r[I.loading]),
      unloading: num(r[I.unloading]),
      driverPay: num(r[I.driverPay]),
      expensesSubtotal: num(r[I.expSub]),
      diesel: num(r[I.diesel]),
      totalExpenses: num(r[I.totalExp]),
      toll: num(r[I.toll]),
      ownerComm: num(r[I.ownerComm]),
      trueProfit,
      trueMargin: num(r[I.trueMargin]),
      calDays,
      perDay,
      tier: getTier(perDay),
      notes: String(r[I.notes] || ""),
      source,
    });
  }
  return trips;
}

// ─── Parse March "Trip Log" format ───────────────────────
function parseTripLog(data, headerIdx, source) {
  const h = data[headerIdx];
  const trips = [];

  const I = {
    trip: col(h, "#"),
    date: col(h, "date"),
    truck: col(h, "truck"),
    driver: col(h, "driver"),
    from: col(h, "from"),
    to: col(h, "to"),
    cargo: col(h, "cargo"),
    weight: col(h, "weight"),
    rate: col(h, "rate"),
    km: col(h, "km", "total km"),
    revenue: col(h, "revenue"),
    expenses: col(h, "expenses"),
    diesel: col(h, "diesel"),
    toll: col(h, "toll"),
    projProfit: col(h, "projected profit", "proj"),
    calDays: col(h, "cal days"),
    perDay: col(h, "₹/day"),
    tier: col(h, "tier"),
    actual: col(h, "actual"),
  };

  for (let i = headerIdx + 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const first = String(r[0] || "").toLowerCase();
    if (first === "totals" || first === "total") continue;

    const revenue = num(r[I.revenue]);
    if (revenue <= 0) continue;

    const truckInfo = resolveTruck(r[I.truck]);
    const driver = r[I.driver]
      ? String(r[I.driver]).trim()
      : truckInfo?.driver || "Unknown";
    const diesel = num(r[I.diesel]);
    const expenses = num(r[I.expenses]);
    const toll = num(r[I.toll]);
    const projProfit = num(r[I.projProfit]);
    const calDays = num(r[I.calDays]);
    const perDay = num(r[I.perDay]);
    const tierRaw = parseTierString(r[I.tier]);

    trips.push({
      tripNum: num(r[I.trip]),
      date: parseDate(r[I.date]),
      truck: truckInfo?.truck || String(r[I.truck] || ""),
      driver,
      regn: truckInfo?.regn || "",
      from: String(r[I.from] || ""),
      to: String(r[I.to] || ""),
      cargo: String(r[I.cargo] || ""),
      weight: num(r[I.weight]) || null,
      rate: num(r[I.rate]) || null,
      unit: "Ton",
      km: num(r[I.km]) || null,
      revenue,
      commission: 0,
      loading: 0,
      unloading: 0,
      driverPay: 0,
      expensesSubtotal: expenses,
      diesel,
      totalExpenses: expenses + diesel,
      toll,
      ownerComm: 0,
      trueProfit: projProfit,
      trueMargin: revenue > 0 ? projProfit / revenue : 0,
      calDays:
        calDays ||
        (perDay > 0 && projProfit > 0 ? Math.round(projProfit / perDay) : 0),
      perDay,
      tier: tierRaw || (perDay > 0 ? getTier(perDay) : null),
      notes: "",
      source,
    });
  }
  return trips;
}

// ─── Parse P&L Ledger ────────────────────────────────────
function parsePnl(data, headerIdx, source) {
  const h = data[headerIdx];
  const entries = [];

  const iDate = col(h, "date");
  let iTruck1 = -1,
    iTruck2 = -1;
  for (let c = 0; c < h.length; c++) {
    const hdr = String(h[c] || "").toLowerCase();
    if (hdr.includes("8764") || (hdr.includes("t1") && !hdr.includes("t1")))
      iTruck1 = c;
    if (hdr.includes("8796") || hdr.includes("4dce")) iTruck2 = c;
  }
  // Fallback: columns 2 and 3
  if (iTruck1 === -1) iTruck1 = 2;
  if (iTruck2 === -1) iTruck2 = 3;
  const iNotes = col(h, "notes");

  for (let i = headerIdx + 1; i < data.length; i++) {
    const r = data[i];
    if (!r) continue;
    const first = String(r[0] || r[col(h, "s.no")] || "").toLowerCase();
    if (first === "total" || first === "totals" || first === "summary") break;

    const date = parseDate(r[iDate]);
    if (!date) continue;

    entries.push({
      date,
      truck1Amount: num(r[iTruck1]) || null,
      truck2Amount: num(r[iTruck2]) || null,
      notes: String(r[iNotes] || ""),
      source,
    });
  }
  return entries;
}

// ─── Load all Excel files ────────────────────────────────
function loadAllData(dataDir) {
  const allTrips = [];
  const allPnl = [];

  if (!fs.existsSync(dataDir)) {
    console.warn("Data directory not found:", dataDir);
    return { trips: [], pnl: [], months: [] };
  }

  const files = fs.readdirSync(dataDir).filter((f) => /\.xlsx?$/i.test(f));
  console.log(`Found ${files.length} Excel file(s) in ${dataDir}`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const wb = XLSX.readFile(filePath, { cellDates: true });

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      const detected = findHeaderRow(data);
      if (!detected) continue;

      const { rowIndex, format } = detected;
      console.log(`  ${file} → "${sheetName}" detected as ${format}`);

      if (format === "consolidated") {
        allTrips.push(
          ...parseConsolidated(data, rowIndex, `${file}:${sheetName}`),
        );
      } else if (format === "triplog") {
        allTrips.push(...parseTripLog(data, rowIndex, `${file}:${sheetName}`));
      } else if (format === "pnl") {
        allPnl.push(...parsePnl(data, rowIndex, `${file}:${sheetName}`));
      }
    }
  }

  // Assign billing cycle month per source sheet
  const sourceGroups = {};
  for (const trip of allTrips) {
    if (!trip.date) continue;
    if (!sourceGroups[trip.source]) sourceGroups[trip.source] = [];
    sourceGroups[trip.source].push(trip);
  }
  for (const trips of Object.values(sourceGroups)) {
    const earliest = trips
      .map((t) => t.date)
      .filter(Boolean)
      .sort()[0];
    const cycleMonth = earliest ? earliest.slice(0, 7) : "unknown";
    for (const t of trips) t.month = cycleMonth;
  }

  const months = [
    ...new Set(allTrips.map((t) => t.month).filter(Boolean)),
  ].sort();
  console.log(
    `Loaded ${allTrips.length} trips across months: ${months.join(", ")}`,
  );

  return { trips: allTrips, pnl: allPnl, months };
}

// ─── Metrics computation ─────────────────────────────────
function computeMetrics(trips) {
  if (!trips.length) return null;

  const dates = trips
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  const minDate = new Date(dates[0]);
  const maxDate = new Date(dates[dates.length - 1]);
  const daysInPeriod = Math.ceil((maxDate - minDate) / 86400000) + 1;

  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  const totalDiesel = trips.reduce((s, t) => s + t.diesel, 0);
  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const totalExpenses = trips.reduce((s, t) => s + t.totalExpenses, 0);

  const fleetPerDay = daysInPeriod > 0 ? totalProfit / daysInPeriod : 0;
  const projected30d = fleetPerDay * 30;

  const tierCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const t of trips)
    if (t.tier && tierCounts[t.tier] !== undefined) tierCounts[t.tier]++;

  return {
    fleetPerDay: Math.round(fleetPerDay),
    emiCoverage: Math.round((projected30d / EMI) * 100) / 100,
    afterEmi: Math.round(projected30d - EMI),
    projected30d: Math.round(projected30d),
    totalRevenue,
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
    totalDiesel,
    totalProfit: Math.round(totalProfit),
    totalExpenses,
    daysInPeriod,
    dateRange: { from: dates[0], to: dates[dates.length - 1] },
  };
}

function computeDriverStats(trips) {
  const drivers = {};
  for (const trip of trips) {
    const d = trip.driver;
    if (!drivers[d])
      drivers[d] = { driver: d, truck: trip.truck, regn: trip.regn, trips: [] };
    drivers[d].trips.push(trip);
  }

  const result = {};
  for (const [name, data] of Object.entries(drivers)) {
    const t = data.trips;
    const totalRevenue = t.reduce((s, x) => s + x.revenue, 0);
    const totalDiesel = t.reduce((s, x) => s + x.diesel, 0);
    const totalProfit = t.reduce((s, x) => s + x.trueProfit, 0);
    const totalKm = t.reduce((s, x) => s + (x.km || 0), 0);
    const withWeight = t.filter((x) => x.weight);
    const avgTons =
      withWeight.length > 0
        ? withWeight.reduce((s, x) => s + x.weight, 0) / withWeight.length
        : 0;

    result[name] = {
      driver: name,
      truck: data.truck,
      regn: data.regn,
      totalTrips: t.length,
      totalRevenue,
      totalDiesel,
      totalKm,
      totalProfit: Math.round(totalProfit),
      dieselPerKm:
        totalKm > 0 ? Math.round((totalDiesel / totalKm) * 10) / 10 : null,
      avgTons: Math.round(avgTons * 10) / 10,
      fTierTrips: t.filter((x) => x.tier === "F").length,
      margin:
        totalRevenue > 0
          ? Math.round((totalProfit / totalRevenue) * 1000) / 10
          : 0,
      avgProfitPerTrip: t.length > 0 ? Math.round(totalProfit / t.length) : 0,
      avgPerDay: (() => {
        const totalDays = t.reduce((s, x) => s + (x.calDays || 0), 0);
        return totalDays > 0 ? Math.round(totalProfit / totalDays) : 0;
      })(),
    };
  }
  return result;
}

function computeCargoStats(trips) {
  const map = {};
  for (const t of trips) {
    const cargo = t.cargo || "Unknown";
    if (!map[cargo])
      map[cargo] = {
        cargo,
        trips: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalDays: 0,
      };
    map[cargo].trips++;
    map[cargo].totalRevenue += t.revenue;
    map[cargo].totalProfit += t.trueProfit;
    map[cargo].totalDays += t.calDays || 0;
  }
  return Object.values(map)
    .map((c) => ({
      ...c,
      avgRevenue: Math.round(c.totalRevenue / c.trips),
      avgProfit: Math.round(c.totalProfit / c.trips),
      margin:
        c.totalRevenue > 0
          ? Math.round((c.totalProfit / c.totalRevenue) * 1000) / 10
          : 0,
      avgPerDay: c.totalDays > 0 ? Math.round(c.totalProfit / c.totalDays) : 0,
    }))
    .sort((a, b) => b.avgPerDay - a.avgPerDay);
}

function computeCostStructure(trips) {
  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  if (!totalRevenue) return null;

  const totalDiesel = trips.reduce((s, t) => s + t.diesel, 0);
  const totalToll = trips.reduce((s, t) => s + t.toll, 0);
  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);

  const hasDetail = trips.some((t) => t.driverPay > 0);
  let driverPay, loading, commission;

  if (hasDetail) {
    driverPay = trips.reduce((s, t) => s + t.driverPay, 0);
    loading = trips.reduce((s, t) => s + t.loading + t.unloading, 0);
    commission = trips.reduce((s, t) => s + t.commission, 0);
  } else {
    driverPay = Math.round(totalRevenue * 0.14);
    const totalExp = trips.reduce((s, t) => s + t.expensesSubtotal, 0);
    const remaining = totalExp - driverPay;
    loading = Math.round(remaining * 0.55);
    commission = Math.round(remaining * 0.2);
  }

  const other =
    totalRevenue -
    totalDiesel -
    driverPay -
    loading -
    commission -
    totalToll -
    totalProfit;
  const p = (v) => Math.round((v / totalRevenue) * 1000) / 10;

  return {
    diesel: p(totalDiesel),
    driverPay: p(driverPay),
    loading: p(loading),
    toll: p(totalToll),
    commission: p(commission),
    other: p(Math.max(0, other)),
    profit: p(totalProfit),
    estimated: !hasDetail,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INTELLIGENCE ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function computeDailyTimeline(trips) {
  const sorted = trips
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];

  const startDate = new Date(sorted[0].date + "T00:00:00");
  const endDate = new Date(sorted[sorted.length - 1].date + "T00:00:00");
  const timeline = [];
  let cumProfit = 0;
  let cumRevenue = 0;
  let cumTrips = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayTrips = sorted.filter((t) => t.date === dateStr);
    const dayProfit = dayTrips.reduce((s, t) => s + t.trueProfit, 0);
    const dayRevenue = dayTrips.reduce((s, t) => s + t.revenue, 0);
    cumProfit += dayProfit;
    cumRevenue += dayRevenue;
    cumTrips += dayTrips.length;

    const daysElapsed = Math.ceil((current - startDate) / 86400000) + 1;
    timeline.push({
      date: dateStr,
      label: current.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      dayProfit: Math.round(dayProfit),
      dayRevenue: Math.round(dayRevenue),
      trips: dayTrips.length,
      cumProfit: Math.round(cumProfit),
      cumRevenue: Math.round(cumRevenue),
      runningAvg: Math.round(cumProfit / daysElapsed),
      target: Math.round(EMI_PER_DAY),
      daysElapsed,
    });
    current.setDate(current.getDate() + 1);
  }
  return timeline;
}

function computePace(trips, month) {
  const sorted = trips
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;

  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const startDate = new Date(sorted[0].date + "T00:00:00");
  const endDate = new Date(sorted[sorted.length - 1].date + "T00:00:00");
  const daysElapsed = Math.ceil((endDate - startDate) / 86400000) + 1;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  const currentPace = daysElapsed > 0 ? totalProfit / daysElapsed : 0;

  // Recent pace (last 7 calendar days)
  const sevenAgo = new Date(endDate);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const recentTrips = sorted.filter(
    (t) => new Date(t.date + "T00:00:00") >= sevenAgo,
  );
  const recentProfit = recentTrips.reduce((s, t) => s + t.trueProfit, 0);
  const recentDays = Math.min(7, daysElapsed);
  const recentPace = recentDays > 0 ? recentProfit / recentDays : currentPace;

  // First half vs second half momentum
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  const firstHalfAvg =
    firstHalf.length > 0
      ? firstHalf.reduce((s, t) => s + t.trueProfit, 0) / firstHalf.length
      : 0;
  const secondHalfAvg =
    secondHalf.length > 0
      ? secondHalf.reduce((s, t) => s + t.trueProfit, 0) / secondHalf.length
      : 0;
  const momentum =
    firstHalfAvg > 0
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
      : 0;

  const projected = currentPace * daysInMonth;

  return {
    daysElapsed,
    daysRemaining,
    daysInMonth,
    totalProfit: Math.round(totalProfit),
    totalRevenue: Math.round(totalRevenue),
    currentPace: Math.round(currentPace),
    recentPace: Math.round(recentPace),
    targetPace: Math.round(EMI / daysInMonth),
    pctComplete: Math.round((daysElapsed / daysInMonth) * 100),
    projected: Math.round(projected),
    afterEmi: Math.round(projected - EMI),
    momentum: Math.round(momentum),
    // Scenarios
    currentTrajectory: Math.round(totalProfit + daysRemaining * currentPace),
    strongFinish: Math.round(
      totalProfit + daysRemaining * Math.max(currentPace, recentPace) * 1.15,
    ),
    bestCase: Math.round(totalProfit + daysRemaining * currentPace * 1.4),
    worstCase: Math.round(totalProfit + daysRemaining * currentPace * 0.6),
    tripsPerDay:
      daysElapsed > 0
        ? Math.round((trips.length / daysElapsed) * 100) / 100
        : 0,
    tripsNeededForEmi:
      currentPace > 0
        ? Math.ceil((EMI - totalProfit) / (totalProfit / trips.length))
        : 99,
  };
}

function computeGapAnalysis(trips) {
  const drivers = {};
  for (const t of trips) {
    if (!t.date) continue;
    if (!drivers[t.driver]) drivers[t.driver] = [];
    drivers[t.driver].push(t);
  }

  const result = {};
  for (const [driver, driverTrips] of Object.entries(drivers)) {
    const sorted = driverTrips.sort((a, b) => a.date.localeCompare(b.date));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date + "T00:00:00");
      const curr = new Date(sorted[i].date + "T00:00:00");
      const days = Math.ceil((curr - prev) / 86400000);
      gaps.push({ days, from: sorted[i - 1].date, to: sorted[i].date });
    }
    const idleDays = gaps.reduce((s, g) => s + Math.max(0, g.days - 1), 0);
    const avgGap =
      gaps.length > 0 ? gaps.reduce((s, g) => s + g.days, 0) / gaps.length : 0;
    const trend =
      gaps.length >= 3
        ? gaps.slice(-3).map((g) => g.days)
        : gaps.map((g) => g.days);
    const trendDir =
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
      idleDays,
      avgGap: Math.round(avgGap * 10) / 10,
      maxGap: gaps.length > 0 ? Math.max(...gaps.map((g) => g.days)) : 0,
      trend,
      trendDir,
      revenuePerIdleDay:
        idleDays > 0
          ? Math.round(
              sorted.reduce((s, t) => s + t.trueProfit, 0) / sorted.length,
            )
          : 0,
    };
  }
  return result;
}

function computeRouteStats(trips) {
  const routes = {};
  for (const t of trips) {
    if (!t.from || !t.to) continue;
    const key = `${t.from}→${t.to}`;
    if (!routes[key])
      routes[key] = { route: key, from: t.from, to: t.to, trips: [], count: 0 };
    routes[key].trips.push(t);
    routes[key].count++;
  }

  return Object.values(routes)
    .map((r) => {
      const validTrips = r.trips.filter((t) => t.perDay > 0);
      const totalProfit = r.trips.reduce((s, t) => s + t.trueProfit, 0);
      const totalRevenue = r.trips.reduce((s, t) => s + t.revenue, 0);
      const totalDays = r.trips.reduce((s, t) => s + (t.calDays || 0), 0);
      return {
        route: r.route,
        from: r.from,
        to: r.to,
        count: r.count,
        avgPerDay: totalDays > 0 ? Math.round(totalProfit / totalDays) : 0,
        avgProfit: r.count > 0 ? Math.round(totalProfit / r.count) : 0,
        avgRevenue: r.count > 0 ? Math.round(totalRevenue / r.count) : 0,
        margin:
          totalRevenue > 0
            ? Math.round((totalProfit / totalRevenue) * 1000) / 10
            : 0,
        tiers: r.trips.map((t) => t.tier).filter(Boolean),
      };
    })
    .sort((a, b) => b.avgPerDay - a.avgPerDay);
}

function generateInsights(trips, prevTrips) {
  const insights = [];
  if (!trips.length) return insights;

  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const totalDiesel = trips.reduce((s, t) => s + t.diesel, 0);
  const dieselPct = totalRevenue > 0 ? (totalDiesel / totalRevenue) * 100 : 0;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const prevTotalRevenue = prevTrips.reduce((s, t) => s + t.revenue, 0);
  const prevTotalProfit = prevTrips.reduce((s, t) => s + t.trueProfit, 0);
  const prevTotalDiesel = prevTrips.reduce((s, t) => s + t.diesel, 0);
  const prevDieselPct =
    prevTotalRevenue > 0 ? (prevTotalDiesel / prevTotalRevenue) * 100 : 0;
  const prevMargin =
    prevTotalRevenue > 0 ? (prevTotalProfit / prevTotalRevenue) * 100 : 0;

  // 1. F-tier concentration
  const fTrips = trips.filter((t) => t.tier === "F");
  if (fTrips.length > 0) {
    const byDriver = {};
    fTrips.forEach((t) => {
      byDriver[t.driver] = (byDriver[t.driver] || 0) + 1;
    });
    const worst = Object.entries(byDriver).sort((a, b) => b[1] - a[1]);
    const lostRev = fTrips.reduce(
      (s, t) => s + Math.max(0, 2000 - t.perDay) * (t.calDays || 1),
      0,
    );
    insights.push({
      severity: "red",
      icon: "🔴",
      title: `${fTrips.length} F-tier trips (< ₹1,000/day)`,
      detail: worst.map(([d, c]) => `${d}: ${c}`).join(", "),
      impact: `₹${Math.round(lostRev).toLocaleString("en-IN")} lost vs C-tier baseline`,
    });
  }

  // 2. A-tier drought
  const aTrips = trips.filter((t) => t.tier === "A");
  const sorted = trips
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (aTrips.length === 0) {
    insights.push({
      severity: "amber",
      icon: "🟡",
      title: "Zero A-tier trips this month",
      detail: "No trip hit ₹5,000+/day. Premium loads missing.",
      impact: "A single A-tier trip adds ~₹5K-15K profit",
    });
  } else {
    const lastA = aTrips.sort((a, b) => b.date.localeCompare(a.date))[0];
    const lastDate = sorted[sorted.length - 1]?.date;
    if (lastA && lastDate) {
      const daysSince = Math.ceil(
        (new Date(lastDate) - new Date(lastA.date)) / 86400000,
      );
      if (daysSince > 5) {
        insights.push({
          severity: "amber",
          icon: "🟡",
          title: `${daysSince}d since last A-tier trip`,
          detail: `Last: ${lastA.from}→${lastA.to} (₹${lastA.perDay}/day)`,
          impact: "Premium load drought — check broker pipeline",
        });
      }
    }
  }

  // 3. Diesel efficiency change
  if (prevTrips.length > 0 && prevDieselPct > 0) {
    const change = dieselPct - prevDieselPct;
    if (Math.abs(change) > 0.5) {
      const saved = Math.round((Math.abs(change) / 100) * totalRevenue);
      insights.push({
        severity: change < 0 ? "green" : "red",
        icon: change < 0 ? "🟢" : "🔴",
        title: `Diesel ${change < 0 ? "improved" : "worsened"} ${Math.abs(change).toFixed(1)}pp`,
        detail: `${dieselPct.toFixed(1)}% of revenue (was ${prevDieselPct.toFixed(1)}%)`,
        impact: `${change < 0 ? "Saving" : "Losing"} ~₹${saved.toLocaleString("en-IN")} this month`,
      });
    }
  }

  // 4. Margin compression/expansion
  if (prevTrips.length > 0 && prevMargin > 0) {
    const delta = margin - prevMargin;
    if (Math.abs(delta) > 1) {
      const profitGap = Math.round((Math.abs(delta) / 100) * totalRevenue);
      insights.push({
        severity: delta > 0 ? "green" : "red",
        icon: delta > 0 ? "🟢" : "🔴",
        title: `Margin ${delta > 0 ? "expanded" : "compressed"} ${Math.abs(delta).toFixed(1)}pp`,
        detail: `${margin.toFixed(1)}% (was ${prevMargin.toFixed(1)}%)`,
        impact: `₹${profitGap.toLocaleString("en-IN")} ${delta > 0 ? "gain" : "gap"} on same revenue`,
      });
    }
  }

  // 5. Overloading premium
  const heavy = trips.filter((t) => t.weight && t.weight >= 30 && t.perDay > 0);
  const light = trips.filter(
    (t) => t.weight && t.weight < 25 && t.weight > 0 && t.perDay > 0,
  );
  if (heavy.length >= 2 && light.length >= 2) {
    const heavyAvg = heavy.reduce((s, t) => s + t.perDay, 0) / heavy.length;
    const lightAvg = light.reduce((s, t) => s + t.perDay, 0) / light.length;
    if (heavyAvg > lightAvg) {
      insights.push({
        severity: "green",
        icon: "📦",
        title: `Overloading earns ₹${Math.round(heavyAvg - lightAvg).toLocaleString("en-IN")}/day more`,
        detail: `≥30T avg ₹${Math.round(heavyAvg)}/day vs <25T avg ₹${Math.round(lightAvg)}/day`,
        impact: "Extra tons = extra revenue. Push for full loads.",
      });
    }
  }

  // 6. Break-even violations
  const belowBreakeven = trips.filter((t) => t.revenue < 18181);
  if (belowBreakeven.length > 0) {
    insights.push({
      severity: "red",
      icon: "⚠️",
      title: `${belowBreakeven.length} trips below ₹18,181 break-even`,
      detail: belowBreakeven
        .map((t) => `T${t.tripNum} ₹${t.revenue.toLocaleString("en-IN")}`)
        .join(", "),
      impact: "Guaranteed loss after diesel + expenses. Reject these loads.",
    });
  }

  // 7. Revenue concentration
  const cargoMap = {};
  trips.forEach((t) => {
    cargoMap[t.cargo] = (cargoMap[t.cargo] || 0) + 1;
  });
  const topCargo = Object.entries(cargoMap).sort((a, b) => b[1] - a[1])[0];
  if (topCargo && topCargo[1] / trips.length > 0.5) {
    insights.push({
      severity: "amber",
      icon: "🟡",
      title: `${Math.round((topCargo[1] / trips.length) * 100)}% revenue from "${topCargo[0]}"`,
      detail: `${topCargo[1]} of ${trips.length} trips. Single-cargo dependency.`,
      impact: "Rate cuts or seasonal dip in this cargo = fleet-wide hit",
    });
  }

  // 8. Driver with zero F-tier
  const driverTrips = {};
  trips.forEach((t) => {
    if (!driverTrips[t.driver]) driverTrips[t.driver] = { total: 0, fTier: 0 };
    driverTrips[t.driver].total++;
    if (t.tier === "F") driverTrips[t.driver].fTier++;
  });
  for (const [driver, stats] of Object.entries(driverTrips)) {
    if (stats.total >= 5 && stats.fTier === 0) {
      insights.push({
        severity: "green",
        icon: "⭐",
        title: `${driver}: ${stats.total} trips, ZERO F-tier`,
        detail: "Consistent route/load selection. Margin specialist.",
        impact: "Model this behavior for the other driver",
      });
    }
  }

  // 9. Momentum (first half vs second half)
  if (sorted.length >= 6) {
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);
    const firstAvg = first.reduce((s, t) => s + t.trueProfit, 0) / first.length;
    const secondAvg =
      second.reduce((s, t) => s + t.trueProfit, 0) / second.length;
    const pctChange =
      firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    if (Math.abs(pctChange) > 15) {
      insights.push({
        severity: pctChange > 0 ? "green" : "red",
        icon: pctChange > 0 ? "📈" : "📉",
        title: `Fleet ${pctChange > 0 ? "accelerating" : "decelerating"} ${Math.abs(pctChange).toFixed(0)}%`,
        detail: `First half avg ₹${Math.round(firstAvg)}/trip → second half ₹${Math.round(secondAvg)}/trip`,
        impact:
          pctChange > 0
            ? "Momentum is building — sustain it"
            : "Investigate: rates dropping? Longer gaps?",
      });
    }
  }

  // Sort: red first, then amber, then green
  const order = { red: 0, amber: 1, green: 2 };
  insights.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  return insights;
}

function generateActions(trips, prevTrips) {
  const actions = [];
  if (!trips.length) return actions;

  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  const totalProfit = trips.reduce((s, t) => s + t.trueProfit, 0);
  const avgProfitPerTrip = totalProfit / trips.length;

  // 1. Load factor optimization
  const withWeight = trips.filter((t) => t.weight && t.weight > 0);
  if (withWeight.length > 0) {
    const avgLoad =
      withWeight.reduce((s, t) => s + t.weight, 0) / withWeight.length;
    const capacity = 27.5;
    const loadFactor = avgLoad / capacity;
    if (loadFactor < 0.92) {
      const potentialGain = Math.round(
        ((0.95 - loadFactor) * capacity * 850 * trips.length) /
          withWeight.length,
      );
      actions.push({
        priority: 1,
        effort: "Low",
        title: `Push loads from ${Math.round(loadFactor * 100)}% to 95% capacity`,
        detail: `Avg ${avgLoad.toFixed(1)}T on ${capacity}T capacity. Wait 1 extra day for full truck vs leaving 20% empty.`,
        impact: `+₹${Math.max(0, potentialGain).toLocaleString("en-IN")}/month`,
      });
    }
  }

  // 2. Eliminate F-tier
  const fTrips = trips.filter((t) => t.tier === "F");
  if (fTrips.length > 0) {
    const fAvg = fTrips.reduce((s, t) => s + t.trueProfit, 0) / fTrips.length;
    const cAvg = 2500; // target C-tier avg
    const gain = Math.round((cAvg - fAvg) * fTrips.length);
    actions.push({
      priority: 2,
      effort: "Medium",
      title: `Convert ${fTrips.length} F-tier trips to C-tier minimum`,
      detail: `Use the phone formula: (Revenue - ₹17,500) ÷ Days. Below ₹2,000/day → reject and wait.`,
      impact: `+₹${Math.max(0, gain).toLocaleString("en-IN")}/month`,
    });
  }

  // 3. Target flat rate deals
  const flatTrips = trips.filter(
    (t) =>
      (t.cargo && t.cargo.toLowerCase().includes("flat")) ||
      t.unit === "-" ||
      (t.unit === null && !t.rate),
  );
  const nonFlat = trips.filter((t) => t.perDay > 0 && !flatTrips.includes(t));
  if (flatTrips.length > 0 && flatTrips[0].perDay > 0 && nonFlat.length > 0) {
    const flatAvg =
      flatTrips.reduce((s, t) => s + t.perDay, 0) / flatTrips.length;
    const otherAvg = nonFlat.reduce((s, t) => s + t.perDay, 0) / nonFlat.length;
    if (flatAvg > otherAvg * 1.2) {
      actions.push({
        priority: 3,
        effort: "Medium",
        title: "Chase more flat rate deals",
        detail: `Flat rate avg ₹${Math.round(flatAvg)}/day (${Math.round((flatAvg / otherAvg) * 100 - 100)}% above per-ton).`,
        impact: `+₹${Math.round((flatAvg - otherAvg) * 2).toLocaleString("en-IN")} per converted trip`,
      });
    }
  }

  // 4. Reduce gap days
  const gaps = computeGapAnalysis(trips);
  const totalIdle = Object.values(gaps).reduce((s, g) => s + g.idleDays, 0);
  if (totalIdle > 5) {
    actions.push({
      priority: 4,
      effort: "Low",
      title: `Recover ${totalIdle} idle days between trips`,
      detail: `Each idle day = ₹${Math.round(avgProfitPerTrip / 2).toLocaleString("en-IN")} lost. Pre-book return loads.`,
      impact: `+₹${Math.round((totalIdle * avgProfitPerTrip) / 3).toLocaleString("en-IN")}/month`,
    });
  }

  // 5. Backhaul trips
  actions.push({
    priority: 5,
    effort: "Low",
    title: "Book 2 backhaul trips per month",
    detail:
      "Trucks return empty from destination. Even a C-tier backhaul load beats driving empty.",
    impact: `+₹${Math.round(avgProfitPerTrip * 2).toLocaleString("en-IN")}/month`,
  });

  // 6. EMI-specific
  const projected = (totalProfit / trips.length) * (trips.length + 5); // rough projection
  if (projected < EMI) {
    const deficit = EMI - projected;
    const tripsNeeded = Math.ceil(deficit / avgProfitPerTrip);
    actions.push({
      priority: 1,
      effort: "High",
      title: `Need ${tripsNeeded} more profitable trips to cover EMI`,
      detail: `Projected ₹${Math.round(projected).toLocaleString("en-IN")} vs EMI ₹${EMI.toLocaleString("en-IN")}. Deficit: ₹${Math.round(deficit).toLocaleString("en-IN")}.`,
      impact: "EMI coverage is the survival metric",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

function computeIntelligence(allTrips, month, allMonths) {
  const trips = allTrips.filter((t) => t.month === month);
  const prevMonth = allMonths[allMonths.indexOf(month) - 1];
  const prevTrips = prevMonth
    ? allTrips.filter((t) => t.month === prevMonth)
    : [];

  return {
    daily: computeDailyTimeline(trips),
    pace: computePace(trips, month),
    insights: generateInsights(trips, prevTrips),
    actions: generateActions(trips, prevTrips),
    gaps: computeGapAnalysis(trips),
    routes: computeRouteStats(trips),
    costStructure: computeCostStructure(trips),
    cargo: computeCargoStats(trips),
  };
}

module.exports = {
  loadAllData,
  computeMetrics,
  computeDriverStats,
  computeCargoStats,
  computeCostStructure,
  computeIntelligence,
  EMI,
  EMI_PER_DAY,
  getTier,
};
