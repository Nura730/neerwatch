/**
 * NeerWatch seed script — deterministic synthetic demo data.
 * IMPORTANT: All data here is fictional and for prototype demonstration only.
 * It does not represent real public-health measurements.
 *
 * Usage: npm run seed  (requires MONGODB_URI in backend/.env)
 */
require('dotenv').config();
const mongoose    = require('mongoose');
const bcrypt      = require('bcryptjs');
const Observation = require('../src/models/Observation');
const Cluster     = require('../src/models/Cluster');
const Alert       = require('../src/models/Alert');
const Rainfall    = require('../src/models/Rainfall');
const User        = require('../src/models/User');
const { runClusterDetection } = require('../src/services/clusterDetection');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Create backend/.env from backend/.env.example');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Synthetic ward reference — Kochi / Ernakulam area (Kerala)
// Coordinates are approximate ward centres; all data is fictional.
// ---------------------------------------------------------------------------
const WARDS = [
  { wardId: 'ward-01', lat: 9.9312, lng: 76.2673 }, // Ernakulam North / Marine Drive
  { wardId: 'ward-02', lat: 9.9670, lng: 76.2840 }, // Kaloor / Stadium
  { wardId: 'ward-03', lat: 9.9890, lng: 76.3010 }, // Edapally
  { wardId: 'ward-04', lat: 9.9470, lng: 76.3300 }, // Maradu / Kakkanad
  { wardId: 'ward-05', lat: 9.9550, lng: 76.2950 }, // Palarivattom (background only)
  { wardId: 'ward-06', lat: 9.9200, lng: 76.3100 }, // Thevara / Perumanoor (background only)
];

// ---------------------------------------------------------------------------
// Helper: offset a lat/lng by metres — used to place observations within a
// cluster's geographic footprint.
// ---------------------------------------------------------------------------
function offsetCoords(lat, lng, dLatM, dLngM) {
  return {
    lat: lat + dLatM / 111320,
    lng: lng + dLngM / (111320 * Math.cos((lat * Math.PI) / 180)),
  };
}

// ---------------------------------------------------------------------------
// Build a single observation document.
// Pass lat=null/lng=null to omit location (missing-GPS scenario).
// ---------------------------------------------------------------------------
function makeObs(clientId, householdId, testType, result, testedAtISO, wardId, lat, lng) {
  const obs = { clientId, householdId, testType, result, testedAt: new Date(testedAtISO), wardId };
  if (lat !== null) obs.location = { type: 'Point', coordinates: [lng, lat] };
  return obs;
}

const DAY = 86400000;
// Use current time so observations always fall inside the 7-day cluster detection window.
// The relative spacing (0–8 days ago) is fixed; only absolute timestamps vary per run.
const NOW = Date.now();
const d   = (n) => new Date(NOW - n * DAY).toISOString();

// ---------------------------------------------------------------------------
// CLUSTER 1 — TDS contamination — ward-01 (Ernakulam North / Marine Drive)
// 6 failing TDS observations within ~250m of the ward centre.
// Fail threshold: TDS > 500 mg/L
// ---------------------------------------------------------------------------
const { lat: w1lat, lng: w1lng } = WARDS[0];
const cluster1Obs = [
  makeObs('c1-01', 'HH-101', 'TDS', 680, d(0), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng,    0,    0))),
  makeObs('c1-02', 'HH-102', 'TDS', 720, d(1), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng,  100,   80))),
  makeObs('c1-03', 'HH-103', 'TDS', 590, d(2), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, -100,  120))),
  makeObs('c1-04', 'HH-104', 'TDS', 650, d(3), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng,   80, -100))),
  makeObs('c1-05', 'HH-105', 'TDS', 780, d(4), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng, -150,   50))),
  makeObs('c1-06', 'HH-106', 'TDS', 620, d(5), 'ward-01', ...Object.values(offsetCoords(w1lat, w1lng,  120,  -80))),
];
const ward01Obs = [
  ...cluster1Obs,
  // Passing TDS and other types — provide realistic background
  makeObs('w01-p01', 'HH-107', 'TDS',       280, d(1), 'ward-01', w1lat + 0.003, w1lng + 0.002),
  makeObs('w01-p02', 'HH-108', 'TDS',       350, d(3), 'ward-01', w1lat - 0.002, w1lng + 0.003),
  makeObs('w01-p03', 'HH-109', 'pH',        7.2, d(2), 'ward-01', w1lat + 0.001, w1lng - 0.002),
  makeObs('w01-p04', 'HH-110', 'coliform',    0, d(4), 'ward-01', w1lat - 0.003, w1lng + 0.001),
  // Isolated failing pH — geographically separated; cannot form its own cluster
  makeObs('w01-f01', 'HH-111', 'pH',        6.1, d(2), 'ward-01', w1lat + 0.005, w1lng + 0.005),
  // No GPS — demonstrates missing-location functionality
  makeObs('w01-n01', 'HH-112', 'TDS',       450, d(6), 'ward-01', null, null),
  makeObs('w01-n02', 'HH-113', 'pH',        7.5, d(7), 'ward-01', null, null),
];

// ---------------------------------------------------------------------------
// CLUSTER 2 — coliform contamination — ward-02 (Kaloor / Stadium)
// 5 failing coliform observations within ~200m of the ward centre.
// Fail threshold: coliform > 0 CFU/100mL
// ---------------------------------------------------------------------------
const { lat: w2lat, lng: w2lng } = WARDS[1];
const cluster2Obs = [
  makeObs('c2-01', 'HH-201', 'coliform',  8, d(0), 'ward-02', ...Object.values(offsetCoords(w2lat, w2lng,    0,    0))),
  makeObs('c2-02', 'HH-202', 'coliform', 14, d(1), 'ward-02', ...Object.values(offsetCoords(w2lat, w2lng,   90,   70))),
  makeObs('c2-03', 'HH-203', 'coliform', 22, d(2), 'ward-02', ...Object.values(offsetCoords(w2lat, w2lng,  -80,  100))),
  makeObs('c2-04', 'HH-204', 'coliform',  5, d(3), 'ward-02', ...Object.values(offsetCoords(w2lat, w2lng,  120,  -60))),
  makeObs('c2-05', 'HH-205', 'coliform', 31, d(4), 'ward-02', ...Object.values(offsetCoords(w2lat, w2lng,  -60, -110))),
];
const ward02Obs = [
  ...cluster2Obs,
  // Passing background observations
  makeObs('w02-p01', 'HH-206', 'TDS',       340, d(1), 'ward-02', w2lat + 0.002, w2lng + 0.001),
  makeObs('w02-p02', 'HH-207', 'TDS',       210, d(3), 'ward-02', w2lat - 0.002, w2lng + 0.002),
  makeObs('w02-p03', 'HH-208', 'pH',        7.4, d(2), 'ward-02', w2lat + 0.003, w2lng - 0.001),
  makeObs('w02-p04', 'HH-209', 'coliform',   0,  d(5), 'ward-02', w2lat - 0.004, w2lng + 0.002),
  // Isolated failing TDS — too few and too far to form a TDS cluster here
  makeObs('w02-f01', 'HH-210', 'TDS',       550, d(1), 'ward-02', w2lat + 0.005, w2lng + 0.005),
  // No GPS
  makeObs('w02-n01', 'HH-211', 'TDS',       390, d(5), 'ward-02', null, null),
];

// ---------------------------------------------------------------------------
// CLUSTER 3 — turbidity contamination — ward-03 (Edapally)
// 6 failing turbidity observations within ~200m of the ward centre.
// Fail threshold: turbidity > 4 NTU
// ---------------------------------------------------------------------------
const { lat: w3lat, lng: w3lng } = WARDS[2];
const cluster3Obs = [
  makeObs('c3-01', 'HH-301', 'turbidity',  7.2, d(0), 'ward-03', ...Object.values(offsetCoords(w3lat, w3lng,    0,    0))),
  makeObs('c3-02', 'HH-302', 'turbidity',  9.5, d(1), 'ward-03', ...Object.values(offsetCoords(w3lat, w3lng,   80,   60))),
  makeObs('c3-03', 'HH-303', 'turbidity', 12.1, d(2), 'ward-03', ...Object.values(offsetCoords(w3lat, w3lng, -100,   90))),
  makeObs('c3-04', 'HH-304', 'turbidity',  6.8, d(3), 'ward-03', ...Object.values(offsetCoords(w3lat, w3lng,   60, -130))),
  makeObs('c3-05', 'HH-305', 'turbidity',  5.3, d(4), 'ward-03', ...Object.values(offsetCoords(w3lat, w3lng, -130,  -70))),
  makeObs('c3-06', 'HH-306', 'turbidity',  8.9, d(5), 'ward-03', ...Object.values(offsetCoords(w3lat, w3lng,  110,  100))),
];
const ward03Obs = [
  ...cluster3Obs,
  // Passing background observations
  makeObs('w03-p01', 'HH-307', 'turbidity', 1.8, d(1), 'ward-03', w3lat + 0.003, w3lng + 0.002),
  makeObs('w03-p02', 'HH-308', 'TDS',       280, d(2), 'ward-03', w3lat - 0.002, w3lng + 0.003),
  makeObs('w03-p03', 'HH-309', 'pH',        7.0, d(3), 'ward-03', w3lat + 0.002, w3lng - 0.002),
  // Isolated failing pH
  makeObs('w03-f01', 'HH-310', 'pH',        8.8, d(1), 'ward-03', w3lat + 0.005, w3lng + 0.005),
  // No GPS
  makeObs('w03-n01', 'HH-311', 'coliform',   0,  d(4), 'ward-03', null, null),
];

// ---------------------------------------------------------------------------
// CLUSTER 4 — TDS contamination — ward-04 (Maradu / Kakkanad)
// 5 failing TDS observations within ~200m of the ward centre.
// A second TDS cluster in a different ward to the ward-01 TDS cluster.
// ---------------------------------------------------------------------------
const { lat: w4lat, lng: w4lng } = WARDS[3];
const cluster4Obs = [
  makeObs('c4-01', 'HH-401', 'TDS', 560, d(0), 'ward-04', ...Object.values(offsetCoords(w4lat, w4lng,    0,    0))),
  makeObs('c4-02', 'HH-402', 'TDS', 690, d(1), 'ward-04', ...Object.values(offsetCoords(w4lat, w4lng,  100,   50))),
  makeObs('c4-03', 'HH-403', 'TDS', 520, d(2), 'ward-04', ...Object.values(offsetCoords(w4lat, w4lng,  -80,  110))),
  makeObs('c4-04', 'HH-404', 'TDS', 640, d(3), 'ward-04', ...Object.values(offsetCoords(w4lat, w4lng,  130,  -90))),
  makeObs('c4-05', 'HH-405', 'TDS', 580, d(4), 'ward-04', ...Object.values(offsetCoords(w4lat, w4lng, -110,  -60))),
];
const ward04Obs = [
  ...cluster4Obs,
  // Passing background observations
  makeObs('w04-p01', 'HH-406', 'TDS',       190, d(2), 'ward-04', w4lat + 0.003, w4lng + 0.002),
  makeObs('w04-p02', 'HH-407', 'TDS',       320, d(3), 'ward-04', w4lat - 0.002, w4lng + 0.003),
  makeObs('w04-p03', 'HH-408', 'pH',        7.1, d(1), 'ward-04', w4lat + 0.001, w4lng - 0.002),
  // Isolated failing observations — not enough to form clusters
  makeObs('w04-f01', 'HH-409', 'pH',        6.2, d(2), 'ward-04', w4lat + 0.005, w4lng + 0.005),
  makeObs('w04-f02', 'HH-410', 'turbidity', 5.2, d(1), 'ward-04', w4lat - 0.005, w4lng - 0.004),
  // No GPS
  makeObs('w04-n01', 'HH-411', 'TDS',       460, d(6), 'ward-04', null, null),
];

// ---------------------------------------------------------------------------
// Ward-05 — background ward (Palarivattom); no cluster expected.
// A few isolated positives keep the dataset realistic.
// ---------------------------------------------------------------------------
const { lat: w5lat, lng: w5lng } = WARDS[4];
const ward05Obs = [
  makeObs('w05-01', 'HH-501', 'TDS',       220, d(1), 'ward-05', w5lat + 0.001, w5lng + 0.001),
  makeObs('w05-02', 'HH-502', 'TDS',       180, d(2), 'ward-05', w5lat - 0.001, w5lng + 0.002),
  makeObs('w05-03', 'HH-503', 'pH',        7.3, d(3), 'ward-05', w5lat + 0.002, w5lng - 0.001),
  makeObs('w05-04', 'HH-504', 'coliform',   0,  d(1), 'ward-05', w5lat - 0.002, w5lng + 0.001),
  makeObs('w05-05', 'HH-505', 'TDS',       510, d(2), 'ward-05', w5lat + 0.003, w5lng + 0.003), // isolated failing
  makeObs('w05-06', 'HH-506', 'pH',        8.7, d(3), 'ward-05', w5lat - 0.003, w5lng - 0.003), // isolated failing
  makeObs('w05-n01', 'HH-507', 'TDS',      390, d(5), 'ward-05', null, null),
];

// ---------------------------------------------------------------------------
// Ward-06 — background ward (Thevara / Perumanoor); no cluster expected.
// ---------------------------------------------------------------------------
const { lat: w6lat, lng: w6lng } = WARDS[5];
const ward06Obs = [
  makeObs('w06-01', 'HH-601', 'TDS',       290, d(2), 'ward-06', w6lat + 0.001, w6lng + 0.001),
  makeObs('w06-02', 'HH-602', 'pH',        7.0, d(3), 'ward-06', w6lat - 0.001, w6lng + 0.001),
  makeObs('w06-03', 'HH-603', 'turbidity', 2.1, d(1), 'ward-06', w6lat + 0.002, w6lng - 0.001),
  makeObs('w06-04', 'HH-604', 'coliform',   0,  d(2), 'ward-06', w6lat - 0.002, w6lng + 0.002),
  makeObs('w06-05', 'HH-605', 'TDS',       540, d(1), 'ward-06', w6lat + 0.003, w6lng + 0.003), // isolated failing
  makeObs('w06-n01', 'HH-606', 'pH',       7.8, d(4), 'ward-06', null, null),
];

// ---------------------------------------------------------------------------
// Rainfall — 4 main wards × 10 days of synthetic mm readings
// ---------------------------------------------------------------------------
const RAINFALL_MM = {
  'ward-01': [2.3,  0.0,  5.1, 12.4, 8.7, 0.0, 0.0, 3.2, 15.6,  9.1],
  'ward-02': [1.8,  0.0,  4.2, 11.0, 7.5, 0.5, 0.0, 2.8, 14.2,  8.3],
  'ward-03': [3.1,  0.0,  6.3, 13.8, 9.2, 0.0, 0.1, 4.0, 16.8, 10.2],
  'ward-04': [4.2,  0.0,  7.8, 15.2, 11.3, 0.0, 0.3, 5.1, 18.4, 12.7],
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
    User.deleteMany({}),
  ]);

  const allObs = [
    ...ward01Obs,
    ...ward02Obs,
    ...ward03Obs,
    ...ward04Obs,
    ...ward05Obs,
    ...ward06Obs,
  ];
  console.log(`Inserting ${allObs.length} observations...`);
  await Observation.insertMany(allObs);

  const rainfallDocs = buildRainfallDocs();
  console.log(`Inserting ${rainfallDocs.length} rainfall records...`);
  await Rainfall.insertMany(rainfallDocs);

  console.log('Running cluster detection...');
  await runClusterDetection();

  const [clusterCount, alertCount] = await Promise.all([
    Cluster.countDocuments(),
    Alert.countDocuments(),
  ]);

  // Count positives for verification
  const Obs = await Observation.find({}, { testType: 1, result: 1 }).lean();
  const { isFailing } = require('../src/utils/testThresholds');
  const positiveCount = Obs.filter((o) => isFailing(o.testType, o.result)).length;
  const missingCount  = await Observation.countDocuments({ 'location.type': { $exists: false } });

  // ── Seed demo users (development / demo only) ────────────────────────────
  console.log('Seeding demo users...');
  const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const seedUsers = [
    { email: process.env.SEED_ADMIN_EMAIL    || 'admin@neerwatch.local',    password: process.env.SEED_ADMIN_PASSWORD    || 'ChangeThisPassword1!', role: 'admin' },
    { email: process.env.SEED_OPERATOR_EMAIL || 'operator@neerwatch.local', password: process.env.SEED_OPERATOR_PASSWORD || 'ChangeThisPassword2!', role: 'operator' },
    { email: process.env.SEED_VIEWER_EMAIL   || 'viewer@neerwatch.local',   password: process.env.SEED_VIEWER_PASSWORD   || 'ChangeThisPassword3!', role: 'viewer' },
  ];
  for (const u of seedUsers) {
    const hash = await bcrypt.hash(u.password, ROUNDS);
    await User.create({ email: u.email, password: hash, role: u.role });
    console.log(`  Created ${u.role}: ${u.email}`);
  }

  console.log('\nSeed complete.');
  console.log(`  Observations      : ${allObs.length}`);
  console.log(`  Positive (failing): ${positiveCount}`);
  console.log(`  Missing location  : ${missingCount}`);
  console.log(`  Clusters detected : ${clusterCount}`);
  console.log(`  Alerts generated  : ${alertCount}`);
  console.log(`  Rainfall records  : ${rainfallDocs.length}`);
  console.log(`  Users             : ${seedUsers.length} (admin, operator, viewer)`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
