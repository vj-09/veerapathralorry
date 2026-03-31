const express = require("express");
const cors = require("cors");
const path = require("path");
const {
  loadAllData,
  computeMetrics,
  computeDriverStats,
  computeCargoStats,
  computeCostStructure,
  computeIntelligence,
} = require("./parser");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

let cache = null;

function reload() {
  cache = loadAllData(DATA_DIR);
  console.log(
    `✓ ${cache.trips.length} trips loaded, months: [${cache.months.join(", ")}]`,
  );
}

reload();

// ─── API Routes ──────────────────────────────────────────

app.get("/api/months", (req, res) => {
  res.json(cache.months);
});

app.get("/api/metrics", (req, res) => {
  const result = {};
  for (const month of cache.months) {
    result[month] = computeMetrics(
      cache.trips.filter((t) => t.month === month),
    );
  }
  res.json(result);
});

app.get("/api/metrics/:month", (req, res) => {
  const trips = cache.trips.filter((t) => t.month === req.params.month);
  res.json(computeMetrics(trips));
});

app.get("/api/trips", (req, res) => {
  let trips = [...cache.trips];
  if (req.query.month) trips = trips.filter((t) => t.month === req.query.month);
  if (req.query.truck) trips = trips.filter((t) => t.truck === req.query.truck);
  if (req.query.driver)
    trips = trips.filter((t) => t.driver === req.query.driver);
  if (req.query.tier) trips = trips.filter((t) => t.tier === req.query.tier);
  // Sort by date descending
  trips.sort(
    (a, b) =>
      (b.date || "").localeCompare(a.date || "") || b.tripNum - a.tripNum,
  );
  res.json(trips);
});

app.get("/api/drivers/:month", (req, res) => {
  const trips = cache.trips.filter((t) => t.month === req.params.month);
  res.json(computeDriverStats(trips));
});

app.get("/api/drivers", (req, res) => {
  res.json(computeDriverStats(cache.trips));
});

app.get("/api/cargo/:month", (req, res) => {
  const trips = cache.trips.filter((t) => t.month === req.params.month);
  res.json(computeCargoStats(trips));
});

app.get("/api/cargo", (req, res) => {
  res.json(computeCargoStats(cache.trips));
});

app.get("/api/cost-structure/:month", (req, res) => {
  const trips = cache.trips.filter((t) => t.month === req.params.month);
  res.json(computeCostStructure(trips));
});

app.get("/api/intelligence/:month", (req, res) => {
  res.json(computeIntelligence(cache.trips, req.params.month, cache.months));
});

app.get("/api/pnl", (req, res) => {
  res.json(cache.pnl);
});

app.post("/api/reload", (req, res) => {
  reload();
  res.json({ ok: true, trips: cache.trips.length, months: cache.months });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Fleet API → http://localhost:${PORT}`));
