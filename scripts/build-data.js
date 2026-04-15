const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUT_FILE = path.join(__dirname, "..", "public", "api", "fleet-data.json");

// If no Excel files, check for existing JSON (Vercel build case)
const hasExcel =
  fs.existsSync(DATA_DIR) &&
  fs.readdirSync(DATA_DIR).some((f) => /\.xlsx?$/i.test(f));

if (!hasExcel) {
  if (fs.existsSync(OUT_FILE)) {
    console.log("No Excel files — using committed fleet-data.json");
    process.exit(0);
  }
  console.error("No data/ folder and no existing fleet-data.json!");
  process.exit(1);
}

const { loadAllData } = require("../server/parser");

const data = loadAllData(DATA_DIR);

// Single source of truth: allTrips only.
// All metrics, driver stats, cargo, and intelligence are computed
// live in the browser by FleetContext using src/lib/compute.ts.
const result = {
  allTrips: data.trips,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result));
const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(
  `✓ fleet-data.json (${size}KB, ${data.months.length} months, ${data.trips.length} trips)`,
);
