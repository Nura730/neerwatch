/**
 * NeerWatch seed script — deterministic synthetic demo data.
 * IMPORTANT: All data here is fictional and for prototype demonstration only.
 * It does not represent real public-health measurements.
 *
 * Usage: npm run seed  (requires MONGODB_URI in backend/.env)
 */
require('dotenv').config();
const mongoose    = require('mongoose');
const Observation = require('../src/models/Observation');
const Cluster     = require('../src/models/Cluster');
const Alert       = require('../src/models/Alert');
const Rainfall    = require('../src/models/Rainfall');
const { runClusterDetection } = require('../src/services/clusterDetection');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Create backend/.env from backend/.env.example');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Synthetic ward reference (Kerala-style names, fictional locations)
// ---------------------------------------------------------------------------
const WARDS = [
  { wardId: 'ward-01', name: 'Thiruvananthapuram Ward 01', lat: 8.5241, lng: 76.9366 },
  { wardId: 'ward-02', name: 'Thiruvananthapuram Ward 02', lat: 8.5340, lng: 76.9440 },
  { wardId: 'ward-03', name: 'Thiruvananthapuram Ward 03', lat: 8.5150, lng: 76.9280 },
];

// ---------------------------------------------------------------------------
// Helper: offset lat/lng by metres (approximate)
// ---------------------------------------------------------------------------
function offsetCoords(lat, lng, dLatM, dLngM) {
  return {
    lat: lat + dLatM / 111320,
    lng: lng + dLngM / (111320 * Math.cos((lat * Math.PI) / 180)),
  };
}

// ---------------------------------------------------------------------------
// Build observation records
// ---------------------------------------------------------------------------
function makeObs(clientId, householdId, testType, result, testedAtISO, wardId, lat, lng) {
  const obs = { clientId, householdId, testType, result, testedAt: new Date(testedAtISO), wardId };
  if (lat !== null) obs.location = { type: 'Point', coordinates: [lng, lat] };
  return obs;
}

const DAY = 86400000;
// Use current time so observations always fall inside the 7-day cluster detection window.
// The relative spacing (0–8 days ago) is fixed; only the absolute timestamps vary by run.
const NOW = Date.now();
const d = (n) => new Date(NOW - n * DAY).toISOString();

// Ward-01 — includes a TDS cluster (5 failing obs within ~150m, within 7 days)
const { lat: w1lat, lng: w1lng } = WARDS[0];
const clusterObs = [
  makeObs('c-w01-t01', 'HH-101', 'TDS', 620, d(0), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, 0, 0))),
  makeObs('c-w01-t02', 'HH-102', 'TDS', 590, d(1), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, 50, 30))),
  makeObs('c-w01-t03', 'HH-103', 'TDS', 680, d(2), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, -40, 70))),
  makeObs('c-w01-t04', 'HH-104', 'TDS', 720, d(3), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, 80, -20))),
  makeObs('c-w01-t05', 'HH-105', 'TDS', 550, d(4), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, -60, 50))),
];

const ward01Obs = [
  ...clusterObs,
  makeObs('w01-a01', 'HH-106', 'TDS',       280, d(5),  'ward-01', w1lat + 0.002, w1lng + 0.001),
  makeObs('w01-a02', 'HH-107', 'TDS',       310, d(6),  'ward-01', w1lat - 0.001, w1lng + 0.002),
  makeObs('w01-a03', 'HH-108', 'pH',        7.2, d(2),  'ward-01', w1lat + 0.001, w1lng - 0.001),
  makeObs('w01-a04', 'HH-109', 'pH',        6.1, d(3),  'ward-01', w1lat - 0.002, w1lng + 0.003),  // failing
  makeObs('w01-a05', 'HH-110', 'coliform',    0, d(1),  'ward-01', w1lat + 0.003, w1lng - 0.002),
  makeObs('w01-a06', 'HH-111', 'coliform',    2, d(2),  'ward-01', w1lat - 0.001, w1lng + 0.001),  // failing
  makeObs('w01-a07', 'HH-112', 'turbidity', 1.8, d(4),  'ward-01', w1lat + 0.002, w1lng + 0.002),
  // Two without GPS
  makeObs('w01-n01', 'HH-113', 'TDS',       450, d(7),  'ward-01', null, null),
  makeObs('w01-n02', 'HH-114', 'pH',        7.5, d(8),  'ward-01', null, null),
];

// Ward-02
const { lat: w2lat, lng: w2lng } = WARDS[1];
const ward02Obs = [
  makeObs('w02-a01', 'HH-201', 'TDS',       390, d(0),  'ward-02', w2lat,         w2lng),
  makeObs('w02-a02', 'HH-202', 'TDS',       420, d(1),  'ward-02', w2lat + 0.001, w2lng + 0.001),
  makeObs('w02-a03', 'HH-203', 'TDS',       180, d(2),  'ward-02', w2lat - 0.001, w2lng + 0.002),
  makeObs('w02-a04', 'HH-204', 'pH',        7.8, d(3),  'ward-02', w2lat + 0.002, w2lng - 0.001),
  makeObs('w02-a05', 'HH-205', 'pH',        8.9, d(4),  'ward-02', w2lat - 0.002, w2lng + 0.001),  // failing
  makeObs('w02-a06', 'HH-206', 'coliform',    0, d(0),  'ward-02', w2lat + 0.001, w2lng - 0.002),
  makeObs('w02-a07', 'HH-207', 'coliform',    1, d(1),  'ward-02', w2lat - 0.001, w2lng + 0.003),  // failing
  makeObs('w02-a08', 'HH-208', 'turbidity', 3.2, d(2),  'ward-02', w2lat + 0.003, w2lng + 0.001),
  makeObs('w02-a09', 'HH-209', 'turbidity', 5.1, d(3),  'ward-02', w2lat - 0.002, w2lng - 0.001),  // failing
  makeObs('w02-a10', 'HH-210', 'TDS',       260, d(5),  'ward-02', w2lat + 0.001, w2lng + 0.002),
];

// Ward-03
const { lat: w3lat, lng: w3lng } = WARDS[2];
const ward03Obs = [
  makeObs('w03-a01', 'HH-301', 'TDS',       510, d(0),  'ward-03', w3lat,         w3lng),          // failing
  makeObs('w03-a02', 'HH-302', 'TDS',       340, d(1),  'ward-03', w3lat + 0.001, w3lng + 0.001),
  makeObs('w03-a03', 'HH-303', 'TDS',       290, d(2),  'ward-03', w3lat - 0.001, w3lng + 0.001),
  makeObs('w03-a04', 'HH-304', 'pH',        7.0, d(3),  'ward-03', w3lat + 0.002, w3lng - 0.001),
  makeObs('w03-a05', 'HH-305', 'pH',        7.4, d(4),  'ward-03', w3lat - 0.001, w3lng + 0.002),
  makeObs('w03-a06', 'HH-306', 'turbidity', 2.1, d(0),  'ward-03', w3lat + 0.001, w3lng + 0.001),
  makeObs('w03-a07', 'HH-307', 'turbidity', 4.8, d(1),  'ward-03', w3lat - 0.002, w3lng + 0.001),  // failing
  makeObs('w03-a08', 'HH-308', 'coliform',    0, d(2),  'ward-03', w3lat + 0.002, w3lng - 0.002),
  makeObs('w03-a09', 'HH-309', 'coliform',    3, d(3),  'ward-03', w3lat - 0.001, w3lng + 0.001),  // failing
  makeObs('w03-a10', 'HH-310', 'TDS',       470, d(4),  'ward-03', w3lat + 0.001, w3lng + 0.002),
  // Three without GPS
  makeObs('w03-n01', 'HH-311', 'TDS',       380, d(5),  'ward-03', null, null),
  makeObs('w03-n02', 'HH-312', 'pH',        7.1, d(6),  'ward-03', null, null),
  makeObs('w03-n03', 'HH-313', 'coliform',    0, d(7),  'ward-03', null, null),
];

// ---------------------------------------------------------------------------
// Rainfall — 14 days × 3 wards (synthetic mm values)
// ---------------------------------------------------------------------------
const RAINFALL_MM = {
  'ward-01': [2.3, 0.0, 5.1, 12.4, 8.7, 0.0, 0.0, 3.2, 15.6, 9.1, 4.4, 0.0, 2.1, 7.8],
  'ward-02': [1.8, 0.0, 4.2, 11.0, 7.5, 0.5, 0.0, 2.8, 14.2, 8.3, 3.9, 0.2, 1.7, 6.4],
  'ward-03': [3.1, 0.0, 6.3, 13.8, 9.2, 0.0, 0.1, 4.0, 16.8, 10.2, 5.1, 0.0, 2.5, 8.9],
};

function buildRainfallDocs() {
  const docs = [];
  for (const [wardId, values] of Object.entries(RAINFALL_MM)) {
    values.forEach((mm, i) => {
      docs.push({ wardId, rainfallMm: mm, recordedAt: new Date(NOW - i * DAY) });
    });
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  console.log('Clearing existing data...');
  await Promise.all([
    Observation.deleteMany({}),
    Cluster.deleteMany({}),
    Alert.deleteMany({}),
    Rainfall.deleteMany({}),
  ]);

  const allObs = [...ward01Obs, ...ward02Obs, ...ward03Obs];
  console.log(`Inserting ${allObs.length} observations...`);
  await Observation.insertMany(allObs);

  console.log('Inserting rainfall data...');
  await Rainfall.insertMany(buildRainfallDocs());

  console.log('Running cluster detection...');
  await runClusterDetection();

  const [clusterCount, alertCount] = await Promise.all([
    Cluster.countDocuments(),
    Alert.countDocuments(),
  ]);

  console.log(`Seed complete.`);
  console.log(`  Observations : ${allObs.length}`);
  console.log(`  Clusters     : ${clusterCount}`);
  console.log(`  Alerts       : ${alertCount}`);
  console.log(`  Rainfall     : ${Object.values(RAINFALL_MM).flat().length}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
