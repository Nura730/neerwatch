/**
 * NEERWATCH API Gateway — src/services/api.js
 *
 * ALL HTTP requests to the backend must go through this module.
 * Components, pages, and hooks must NOT call fetch() directly.
 *
 * Follows the API contract defined in API_CONTRACT.md exactly.
 * All endpoint names, field names, and response shapes are taken
 * verbatim from the contract. Never rename or invent fields here.
 *
 * Environment:
 *   VITE_API_BASE_URL — backend base URL (no trailing slash)
 *   VITE_USE_MOCK     — "true" → use mock data; "false" → real backend
 */

import {
  MOCK_DASHBOARD,
  MOCK_TESTS,
  MOCK_TESTS_MAP,
  MOCK_CLUSTERS,
  MOCK_ALERTS,
  MOCK_RAINFALL,
  MOCK_WARDS,
  buildMockSyncResponse,
} from './mock.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const USE_MOCK  = import.meta.env.VITE_USE_MOCK === 'true';

/** Simulate network delay in mock mode for realistic UX. */
const mockDelay = (ms = 300) => new Promise(r => setTimeout(r, ms));

import { authService } from '../auth/authService.js';

/**
 * Internal fetch wrapper.
 * Checks HTTP response, parses envelope, throws on success=false.
 */
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = authService.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    throw new Error(`Network error — unable to reach ${url}: ${networkError.message}`);
  }

  // Handle 401 globally
  if (response.status === 401) {
    window.dispatchEvent(new Event('nw:unauthorized'));
    throw new Error('Unauthorized');
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Server returned non-JSON response (HTTP ${response.status})`);
  }

  if (!body.success) {
    const msg = body.message || `Request failed with HTTP ${response.status}`;
    throw new Error(msg);
  }

  return body.data;
}

/**
 * Build a query string from a params object, omitting undefined/null values.
 */
function buildQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard
 * Returns aggregated summary statistics.
 */
export async function getDashboard() {
  if (USE_MOCK) {
    await mockDelay();
    return MOCK_DASHBOARD.data;
  }
  return apiFetch('/api/dashboard');
}

// ── Observations ──────────────────────────────────────────────────────────────

/**
 * GET /api/tests
 * Paginated list of observations.
 * @param {{ page?, limit?, wardId?, testType?, from?, to? }} params
 */
export async function getTests(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    return MOCK_TESTS.data;
  }
  return apiFetch(`/api/tests${buildQuery(params)}`);
}

/**
 * POST /api/tests
 * Create a single observation.
 * @param {Object} body — observation object per API_CONTRACT.md
 */
export async function createTest(body) {
  if (USE_MOCK) {
    await mockDelay(200);
    return { ...body, createdAt: new Date().toISOString() };
  }
  return apiFetch('/api/tests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * GET /api/tests/map
 * Observations with valid locations only, for map rendering.
 * @param {{ wardId?, testType?, from?, to? }} params
 */
export async function getTestsMap(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    return MOCK_TESTS_MAP.data;
  }
  return apiFetch(`/api/tests/map${buildQuery(params)}`);
}

/**
 * POST /api/tests/sync
 * Batch upload of offline-queued observations. Idempotent.
 * @param {Array} observations — array of observation objects
 * Returns { processed, created, duplicates, failed, results[] }
 */
export async function syncTests(observations) {
  if (USE_MOCK) {
    await mockDelay(600);
    return buildMockSyncResponse(observations);
  }
  const data = await apiFetch('/api/tests/sync', {
    method: 'POST',
    body: JSON.stringify({ observations }),
  });
  return data;
}

// ── Clusters ──────────────────────────────────────────────────────────────────

/**
 * GET /api/clusters
 * Detected spatial-temporal clusters.
 * @param {{ active?, wardId? }} params
 */
export async function getClusters(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    if (params.active === true || params.active === 'true') {
      return { clusters: MOCK_CLUSTERS.data.clusters.filter(c => c.active) };
    }
    return MOCK_CLUSTERS.data;
  }
  return apiFetch(`/api/clusters${buildQuery(params)}`);
}

// ── Alerts ────────────────────────────────────────────────────────────────────

/**
 * GET /api/alerts
 * Backend-generated alerts.
 * @param {{ active?, wardId? }} params
 */
export async function getAlerts(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    if (params.active === true || params.active === 'true') {
      return { alerts: MOCK_ALERTS.data.alerts.filter(a => !a.resolved) };
    }
    return MOCK_ALERTS.data;
  }
  return apiFetch(`/api/alerts${buildQuery(params)}`);
}

/**
 * PATCH /api/alerts/:id/resolve
 * Resolve an alert.
 */
export async function resolveAlert(id) {
  if (USE_MOCK) {
    await mockDelay();
    return { id, resolved: true, resolvedAt: new Date().toISOString() };
  }
  return apiFetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
}

// ── Rainfall ──────────────────────────────────────────────────────────────────

/**
 * GET /api/rainfall
 * Rainfall context readings for overlay display.
 * @param {{ wardId?, from?, to? }} params
 */
export async function getRainfall(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    const { rainfall } = MOCK_RAINFALL.data;
    if (params.wardId) {
      return { rainfall: rainfall.filter(r => r.wardId === params.wardId) };
    }
    return MOCK_RAINFALL.data;
  }
  return apiFetch(`/api/rainfall${buildQuery(params)}`);
}

// ── Wards ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/wards
 * Per-ward aggregated summary statistics.
 */
export async function getWards() {
  if (USE_MOCK) {
    await mockDelay();
    return MOCK_WARDS.data;
  }
  return apiFetch('/api/wards');
}

// ── Field Tasks ───────────────────────────────────────────────────────────────

/**
 * GET /api/field-tasks
 * List field investigation tasks.
 * @param {{ status?, wardId?, priority?, assignedTo?, page?, limit? }} params
 */
export async function getFieldTasks(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    return { tasks: [] };
  }
  return apiFetch(`/api/field-tasks${buildQuery(params)}`);
}

/**
 * GET /api/field-tasks/:id
 * Get a single field task by ID.
 */
export async function getFieldTask(id) {
  if (USE_MOCK) {
    await mockDelay();
    return { task: null };
  }
  return apiFetch(`/api/field-tasks/${id}`);
}

/**
 * POST /api/field-tasks
 * Create a new field task.
 * @param {{ title, wardId, description?, location?, priority?, dueAt?, sourceObservationId?, assignedTo? }} body
 */
export async function createFieldTask(body) {
  if (USE_MOCK) {
    await mockDelay(300);
    throw new Error('Field task creation requires a live backend connection.');
  }
  return apiFetch('/api/field-tasks', { method: 'POST', body: JSON.stringify(body) });
}

/**
 * PATCH /api/field-tasks/:id
 * Updates title/description/wardId/location/priority/dueAt (NOT status or assignedTo).
 * @param {string} id
 * @param {Object} body
 */
export async function updateFieldTask(id, body) {
  if (USE_MOCK) {
    await mockDelay(200);
    throw new Error('Field task updates require a live backend connection.');
  }
  return apiFetch(`/api/field-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/**
 * PATCH /api/field-tasks/:id/assign
 * @param {{ assignedTo: string|null }} body — null to unassign
 */
export async function assignFieldTask(id, body) {
  if (USE_MOCK) {
    await mockDelay(200);
    throw new Error('Task assignment requires a live backend connection.');
  }
  return apiFetch(`/api/field-tasks/${id}/assign`, { method: 'PATCH', body: JSON.stringify(body) });
}

/**
 * PATCH /api/field-tasks/:id/status
 * @param {{ status: 'pending'|'assigned'|'in_progress'|'completed'|'cancelled' }} body
 */
export async function updateFieldTaskStatus(id, body) {
  if (USE_MOCK) {
    await mockDelay(200);
    throw new Error('Status updates require a live backend connection.');
  }
  return apiFetch(`/api/field-tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/contamination-trend
 * Time-series contamination analytics. Requires authentication.
 * @param {{ wardId?, testType?, from?, to?, interval?: 'day'|'week'|'month' }} params
 */
export async function getContaminationTrend(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    return { wardId: null, testType: null, interval: params.interval || 'day', series: [] };
  }
  return apiFetch(`/api/analytics/contamination-trend${buildQuery(params)}`);
}

/**
 * GET /api/analytics/data-quality
 * Data quality summary: missing locations, stale, implausible observations. Requires authentication.
 */
export async function getDataQuality() {
  if (USE_MOCK) {
    await mockDelay();
    return { missingLocation: 0, stale: 0, implausible: 0, total: 0 };
  }
  return apiFetch('/api/analytics/data-quality');
}

/**
 * GET /api/analytics/anomaly
 * Anomaly detection signal comparing recent vs baseline contamination rate. Requires authentication.
 * @param {{ wardId?, testType? }} params
 */
export async function getAnomalySignal(params = {}) {
  if (USE_MOCK) {
    await mockDelay();
    return { anomalyDetected: false, recentRate: 0, baselineRate: 0, recentCount: 0, baselineCount: 0, threshold: 1.5 };
  }
  return apiFetch(`/api/analytics/anomaly${buildQuery(params)}`);
}
