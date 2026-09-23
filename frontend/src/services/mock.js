/**
 * NEERWATCH Mock Data
 *
 * All responses mirror the exact shape defined in API_CONTRACT.md.
 * Coordinates are in Kochi/Ernakulam area (Kerala).
 * This data is SYNTHETIC DEMONSTRATION DATA — not real measurements.
 *
 * Scenarios covered:
 *   A  — 8 positive obs within 650 m over 5 days → active cluster
 *   B  — 3 positive obs within 500 m → below threshold (no cluster)
 *   C  — positive obs older than window → not active cluster
 *   D  — isolated positive obs → no cluster
 *   E  — multiple spatial clusters
 *   F  — missing-location observations
 *   G  — duplicate clientId for sync test
 *   H  — delayed/offline observations (pending sync)
 *   I  — rainfall context
 */

// Kochi/Ernakulam centre
const KOCHI_LAT = 9.9312;
const KOCHI_LNG = 76.2673;

// Helper: offset in degrees (~111 km per degree lat, ~97 km per degree lng in Kerala)
const off = (lat, lng) => ({ lat: KOCHI_LAT + lat, lng: KOCHI_LNG + lng });

// ── Wards ────────────────────────────────────────────────────────────────────
export const MOCK_WARDS = {
  success: true,
  data: {
    wards: [
      { wardId: 'ward-01', name: 'Ward 01 — Ernakulam North',  totalTests: 92,  passCount: 68, failCount: 24, failureRate: 0.26, lastTestedAt: '2026-09-23T08:15:00.000Z' },
      { wardId: 'ward-02', name: 'Ward 02 — Mattancherry',      totalTests: 75,  passCount: 51, failCount: 24, failureRate: 0.32, lastTestedAt: '2026-09-22T16:40:00.000Z' },
      { wardId: 'ward-03', name: 'Ward 03 — Fort Kochi',        totalTests: 103, passCount: 87, failCount: 16, failureRate: 0.16, lastTestedAt: '2026-09-23T11:00:00.000Z' },
      { wardId: 'ward-04', name: 'Ward 04 — Edapally',          totalTests: 58,  passCount: 40, failCount: 18, failureRate: 0.31, lastTestedAt: '2026-09-21T14:00:00.000Z' },
      { wardId: 'ward-05', name: 'Ward 05 — Kadavanthra',       totalTests: 44,  passCount: 32, failCount: 12, failureRate: 0.27, lastTestedAt: '2026-09-22T09:30:00.000Z' },
      { wardId: 'ward-06', name: 'Ward 06 — Thevara',           totalTests: 67,  passCount: 41, failCount: 26, failureRate: 0.39, lastTestedAt: '2026-09-23T07:45:00.000Z' },
      { wardId: 'ward-07', name: 'Ward 07 — Vyttila',           totalTests: 88,  passCount: 46, failCount: 42, failureRate: 0.48, lastTestedAt: '2026-09-23T13:20:00.000Z' },
      { wardId: 'ward-08', name: 'Ward 08 — Kalamassery',       totalTests: 51,  passCount: 44, failCount: 7,  failureRate: 0.14, lastTestedAt: '2026-09-20T12:00:00.000Z' },
    ],
  },
};

// ── Observations — full list (GET /api/tests) ────────────────────────────────
export const MOCK_TESTS = {
  success: true,
  data: {
    total: 22,
    page: 1,
    limit: 20,
    observations: [
      // Scenario A — Cluster A: Vyttila, TDS, 8 positives within 650m, last 5 days
      { clientId: 'NW-MOCK-A01', householdId: 'HH-701', testType: 'TDS', result: 420, testedAt: '2026-09-18T08:00:00.000Z', location: off(0.0002, 0.0015), wardId: 'ward-07', createdAt: '2026-09-18T08:05:00.000Z' },
      { clientId: 'NW-MOCK-A02', householdId: 'HH-702', testType: 'TDS', result: 395, testedAt: '2026-09-19T09:30:00.000Z', location: off(0.0004, 0.0018), wardId: 'ward-07', createdAt: '2026-09-19T09:35:00.000Z' },
      { clientId: 'NW-MOCK-A03', householdId: 'HH-703', testType: 'TDS', result: 450, testedAt: '2026-09-20T10:15:00.000Z', location: off(0.0001, 0.0012), wardId: 'ward-07', createdAt: '2026-09-20T10:20:00.000Z' },
      { clientId: 'NW-MOCK-A04', householdId: 'HH-704', testType: 'TDS', result: 380, testedAt: '2026-09-21T11:00:00.000Z', location: off(0.0006, 0.0020), wardId: 'ward-07', createdAt: '2026-09-21T11:05:00.000Z' },
      { clientId: 'NW-MOCK-A05', householdId: 'HH-705', testType: 'TDS', result: 410, testedAt: '2026-09-22T07:45:00.000Z', location: off(0.0003, 0.0016), wardId: 'ward-07', createdAt: '2026-09-22T07:50:00.000Z' },
      { clientId: 'NW-MOCK-A06', householdId: 'HH-706', testType: 'TDS', result: 430, testedAt: '2026-09-22T14:00:00.000Z', location: off(0.0005, 0.0014), wardId: 'ward-07', createdAt: '2026-09-22T14:05:00.000Z' },
      { clientId: 'NW-MOCK-A07', householdId: 'HH-707', testType: 'TDS', result: 365, testedAt: '2026-09-23T06:30:00.000Z', location: off(0.0002, 0.0019), wardId: 'ward-07', createdAt: '2026-09-23T06:35:00.000Z' },
      { clientId: 'NW-MOCK-A08', householdId: 'HH-708', testType: 'TDS', result: 402, testedAt: '2026-09-23T13:20:00.000Z', location: off(0.0004, 0.0017), wardId: 'ward-07', createdAt: '2026-09-23T13:25:00.000Z' },

      // Cluster B: Thevara coliform cluster
      { clientId: 'NW-MOCK-B01', householdId: 'HH-601', testType: 'coliform', result: 12, testedAt: '2026-09-21T09:00:00.000Z', location: off(-0.0050, -0.0040), wardId: 'ward-06', createdAt: '2026-09-21T09:05:00.000Z' },
      { clientId: 'NW-MOCK-B02', householdId: 'HH-602', testType: 'coliform', result: 18, testedAt: '2026-09-22T10:00:00.000Z', location: off(-0.0053, -0.0038), wardId: 'ward-06', createdAt: '2026-09-22T10:05:00.000Z' },
      { clientId: 'NW-MOCK-B03', householdId: 'HH-603', testType: 'coliform', result: 9,  testedAt: '2026-09-22T15:00:00.000Z', location: off(-0.0048, -0.0042), wardId: 'ward-06', createdAt: '2026-09-22T15:05:00.000Z' },
      { clientId: 'NW-MOCK-B04', householdId: 'HH-604', testType: 'coliform', result: 22, testedAt: '2026-09-23T07:45:00.000Z', location: off(-0.0051, -0.0036), wardId: 'ward-06', createdAt: '2026-09-23T07:50:00.000Z' },

      // Scenario D — isolated positive
      { clientId: 'NW-MOCK-D01', householdId: 'HH-201', testType: 'pH', result: 8.9, testedAt: '2026-09-22T08:00:00.000Z', location: off(-0.0200, 0.0100), wardId: 'ward-02', createdAt: '2026-09-22T08:05:00.000Z' },

      // Scenario E — negative observations
      { clientId: 'NW-MOCK-E01', householdId: 'HH-301', testType: 'TDS', result: 140, testedAt: '2026-09-23T10:00:00.000Z', location: off(0.0100, -0.0050), wardId: 'ward-03', createdAt: '2026-09-23T10:05:00.000Z' },
      { clientId: 'NW-MOCK-E02', householdId: 'HH-302', testType: 'pH',  result: 7.1, testedAt: '2026-09-23T11:00:00.000Z', location: off(0.0110, -0.0060), wardId: 'ward-03', createdAt: '2026-09-23T11:05:00.000Z' },
      { clientId: 'NW-MOCK-E03', householdId: 'HH-303', testType: 'TDS', result: 180, testedAt: '2026-09-22T14:30:00.000Z', location: off(-0.0120, 0.0080), wardId: 'ward-01', createdAt: '2026-09-22T14:35:00.000Z' },
      { clientId: 'NW-MOCK-E04', householdId: 'HH-304', testType: 'coliform', result: 0, testedAt: '2026-09-21T09:00:00.000Z', location: off(0.0070, 0.0090), wardId: 'ward-04', createdAt: '2026-09-21T09:05:00.000Z' },

      // Scenario F — missing location
      { clientId: 'NW-MOCK-F01', householdId: 'HH-401', testType: 'turbidity', result: 8.2, testedAt: '2026-09-22T11:00:00.000Z', location: null, wardId: 'ward-04', createdAt: '2026-09-22T11:05:00.000Z' },
      { clientId: 'NW-MOCK-F02', householdId: 'HH-402', testType: 'TDS',       result: 310, testedAt: '2026-09-23T09:00:00.000Z', location: null, wardId: 'ward-05', createdAt: '2026-09-23T09:05:00.000Z' },

      // Scenario C — old observation (beyond 7-day window)
      { clientId: 'NW-MOCK-C01', householdId: 'HH-101', testType: 'TDS', result: 390, testedAt: '2026-09-10T08:00:00.000Z', location: off(0.0010, 0.0015), wardId: 'ward-07', createdAt: '2026-09-10T08:05:00.000Z' },
      { clientId: 'NW-MOCK-C02', householdId: 'HH-102', testType: 'TDS', result: 410, testedAt: '2026-09-11T09:00:00.000Z', location: off(0.0012, 0.0017), wardId: 'ward-07', createdAt: '2026-09-11T09:05:00.000Z' },
    ],
  },
};

// ── Map observations (GET /api/tests/map) — only those with location ─────────
export const MOCK_TESTS_MAP = {
  success: true,
  data: {
    observations: MOCK_TESTS.data.observations.filter(o => o.location !== null),
  },
};

// ── Test thresholds for display ──────────────────────────────────────────────
// These are approximate thresholds used only for visual classification.
// The backend is the authority on contamination determination.
export const TEST_THRESHOLDS = {
  TDS: 500,         // >500 mg/L failing — matches backend testThresholds.js
  pH_low: 6.5,      // <6.5 or >8.5 failing
  pH_high: 8.5,
  turbidity: 4,     // >4 NTU failing
  coliform: 0,      // >0 CFU/100mL failing
};

/**
 * Classify a test result as pass/fail for display purposes only.
 * Backend makes the authoritative determination.
 */
export function classifyResult(testType, result) {
  switch (testType) {
    case 'TDS': return result > TEST_THRESHOLDS.TDS ? 'fail' : 'pass';
    case 'pH':  return (result < TEST_THRESHOLDS.pH_low || result > TEST_THRESHOLDS.pH_high) ? 'fail' : 'pass';
    case 'turbidity': return result > TEST_THRESHOLDS.turbidity ? 'fail' : 'pass';
    case 'coliform':  return result > TEST_THRESHOLDS.coliform ? 'fail' : 'pass';
    default: return 'unknown';
  }
}

// ── Clusters (GET /api/clusters) ─────────────────────────────────────────────
export const MOCK_CLUSTERS = {
  success: true,
  data: {
    clusters: [
      {
        id: 'cluster-001',
        testType: 'TDS',
        centroid: off(0.0003, 0.0016),
        radiusMetres: 650,
        observationCount: 8,
        failureRate: 1.0,
        windowStart: '2026-09-18T00:00:00.000Z',
        windowEnd: '2026-09-23T23:59:59.000Z',
        wardId: 'ward-07',
        detectedAt: '2026-09-23T14:00:00.000Z',
        active: true,
      },
      {
        id: 'cluster-002',
        testType: 'coliform',
        centroid: off(-0.0051, -0.0039),
        radiusMetres: 400,
        observationCount: 4,
        failureRate: 1.0,
        windowStart: '2026-09-21T00:00:00.000Z',
        windowEnd: '2026-09-23T23:59:59.000Z',
        wardId: 'ward-06',
        detectedAt: '2026-09-23T08:00:00.000Z',
        active: true,
      },
    ],
  },
};

// ── Alerts (GET /api/alerts) ─────────────────────────────────────────────────
export const MOCK_ALERTS = {
  success: true,
  data: {
    alerts: [
      {
        id: 'alert-001',
        clusterId: 'cluster-001',
        severity: 'high',
        message: 'Possible TDS contamination cluster detected in Ward 07 — Vyttila. 8 positive observations within 650 m over 6 days.',
        wardId: 'ward-07',
        createdAt: '2026-09-23T14:00:00.000Z',
        resolved: false,
      },
      {
        id: 'alert-002',
        clusterId: 'cluster-002',
        severity: 'high',
        message: 'Possible coliform contamination cluster detected in Ward 06 — Thevara. 4 positive observations within 400 m over 3 days.',
        wardId: 'ward-06',
        createdAt: '2026-09-23T08:00:00.000Z',
        resolved: false,
      },
    ],
  },
};

// ── Rainfall (GET /api/rainfall) ─────────────────────────────────────────────
export const MOCK_RAINFALL = {
  success: true,
  data: {
    rainfall: [
      { wardId: 'ward-07', rainfallMm: 18.2, recordedAt: '2026-09-17T00:00:00.000Z' },
      { wardId: 'ward-07', rainfallMm: 62.4, recordedAt: '2026-09-18T00:00:00.000Z' },
      { wardId: 'ward-07', rainfallMm: 44.1, recordedAt: '2026-09-19T00:00:00.000Z' },
      { wardId: 'ward-07', rainfallMm: 12.8, recordedAt: '2026-09-20T00:00:00.000Z' },
      { wardId: 'ward-07', rainfallMm:  8.0, recordedAt: '2026-09-21T00:00:00.000Z' },
      { wardId: 'ward-07', rainfallMm:  3.5, recordedAt: '2026-09-22T00:00:00.000Z' },
      { wardId: 'ward-07', rainfallMm:  0.0, recordedAt: '2026-09-23T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm: 55.3, recordedAt: '2026-09-17T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm: 71.2, recordedAt: '2026-09-18T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm: 38.9, recordedAt: '2026-09-19T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm: 14.0, recordedAt: '2026-09-20T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm:  9.5, recordedAt: '2026-09-21T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm:  2.1, recordedAt: '2026-09-22T00:00:00.000Z' },
      { wardId: 'ward-06', rainfallMm:  0.0, recordedAt: '2026-09-23T00:00:00.000Z' },
      { wardId: 'ward-01', rainfallMm: 30.0, recordedAt: '2026-09-20T00:00:00.000Z' },
      { wardId: 'ward-01', rainfallMm: 12.0, recordedAt: '2026-09-21T00:00:00.000Z' },
      { wardId: 'ward-01', rainfallMm:  5.0, recordedAt: '2026-09-22T00:00:00.000Z' },
      { wardId: 'ward-01', rainfallMm:  0.0, recordedAt: '2026-09-23T00:00:00.000Z' },
    ],
  },
};

// ── Dashboard (GET /api/dashboard) ───────────────────────────────────────────
export const MOCK_DASHBOARD = {
  success: true,
  data: {
    totalTests: 527,
    positiveTests: 182,
    activeClusters: 2,
    pendingSync: 0,       // will be overridden by local IndexedDB count at runtime
    missingLocations: 2,
  },
};

// ── Sync response (POST /api/tests/sync) ─────────────────────────────────────
export function buildMockSyncResponse(observations) {
  // Simulate: all are 'synced' in mock mode
  const results = observations.map(obs => ({
    clientId: obs.clientId,
    status: 'synced',
  }));
  return {
    success: true,
    data: {
      processed: observations.length,
      created: observations.length,
      duplicates: 0,
      failed: 0,
      results,
    },
  };
}
