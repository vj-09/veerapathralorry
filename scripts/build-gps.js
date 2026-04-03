/**
 * GPS Data Builder
 * Reads iAlert exports from data/gps/ and converts to public/api/gps-points.json
 *
 * Supported input formats:
 *   1. JSON: array of { lat, lng, timestamp, speed?, fuel?, odometer?, address? }
 *   2. iAlert fleet_live.json (scraped format with VEHICLE LOCATION, etc.)
 *   3. Excel exports from iAlert raw data
 *
 * Output: public/api/gps-points.json — array of normalized GPS points
 */

const fs = require("fs");
const path = require("path");

const GPS_DIR = path.join(__dirname, "..", "data", "gps");
const OUT_FILE = path.join(__dirname, "..", "public", "api", "gps-points.json");

const allPoints = [];

if (!fs.existsSync(GPS_DIR)) {
  fs.mkdirSync(GPS_DIR, { recursive: true });
  console.log("Created data/gps/ — drop iAlert exports here");
  // Write empty file so the app doesn't error
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, "[]");
  console.log("✓ Empty gps-points.json created");
  process.exit(0);
}

const files = fs.readdirSync(GPS_DIR).filter((f) => /\.(json|xlsx?)$/i.test(f));

for (const file of files) {
  const filePath = path.join(GPS_DIR, file);
  console.log(`Processing: ${file}`);

  if (file.endsWith(".json")) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Format 1: direct array of GPS points
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (p.lat && p.lng && p.timestamp) {
          allPoints.push(normalize(p));
        }
      }
      continue;
    }

    // Format 2: iAlert fleet_live.json
    if (raw.vehicles) {
      for (const v of raw.vehicles) {
        const loc = v["VEHICLE LOCATION"];
        const ts = v["LOCATION TIMESTAMP"];
        const speed = v["VEHICLE SPEED(kmph)"];
        const fuel = v["FUEL(ltr) / GAS(bar/kg) LEVEL"];
        const odo = v["VEHICLE ODOMETER(Km)"];
        const regn = v["VEHICLE REG. NO."];

        // iAlert gives address, not lat/lng — skip if no coords
        // For now, just log what we have
        if (ts && loc) {
          console.log(`  ${regn}: ${loc} @ ${ts} (no lat/lng in fleet view)`);
        }
      }
      continue;
    }
  }

  if (/\.xlsx?$/i.test(file)) {
    try {
      const XLSX = require("xlsx");
      const wb = XLSX.readFile(filePath, { cellDates: true });
      for (const sheetName of wb.SheetNames) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        for (const row of data) {
          // Try to find lat/lng columns
          const lat =
            row.lat || row.latitude || row.Latitude || row.LAT || null;
          const lng =
            row.lng ||
            row.lon ||
            row.longitude ||
            row.Longitude ||
            row.LNG ||
            row.LON ||
            null;
          const ts =
            row.timestamp ||
            row.Timestamp ||
            row["LOCATION TIMESTAMP"] ||
            row.time ||
            row.Time ||
            null;
          if (lat && lng && ts) {
            allPoints.push(
              normalize({
                lat: Number(lat),
                lng: Number(lng),
                timestamp: String(ts),
                speed:
                  row.speed || row.Speed || row["VEHICLE SPEED(kmph)"] || null,
                fuel: row.fuel || row["FUEL(ltr) / GAS(bar/kg) LEVEL"] || null,
                odometer: row.odometer || row["VEHICLE ODOMETER(Km)"] || null,
                address: row.address || row["VEHICLE LOCATION"] || null,
                vehicle: row.vehicle || row["VEHICLE REG. NO."] || null,
              }),
            );
          }
        }
      }
    } catch (e) {
      console.log(`  Skipped ${file}: ${e.message}`);
    }
  }
}

function normalize(p) {
  return {
    lat: Number(p.lat),
    lng: Number(p.lng),
    timestamp: String(p.timestamp),
    speed: p.speed != null ? Number(p.speed) : undefined,
    fuel: p.fuel != null ? Number(p.fuel) : undefined,
    odometer: p.odometer != null ? Number(p.odometer) : undefined,
    address: p.address || undefined,
    vehicle: p.vehicle || undefined,
  };
}

// Sort by timestamp
allPoints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(allPoints));
const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(
  `✓ gps-points.json (${size}KB, ${allPoints.length} points, ${new Set(allPoints.map((p) => p.timestamp.slice(0, 10))).size} days)`,
);
