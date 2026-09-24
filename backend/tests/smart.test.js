/**
 * Smart innovation features — unit and integration tests.
 * Covers: alert priority signal, anomaly detection, data quality, field task suggestion.
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const request  = require('supertest');
const app      = require('../src/app');
const User        = require('../src/models/User');
const Observation = require('../src/models/Observation');
const { computeAlertPrioritySignal } = require('../src/services/smartPrioritization');

jest.setTimeout(600000);

const NOW = new Date('2024-03-20T12:00:00.000Z');

// ── Smart Alert Prioritization — unit tests ────────────────────────────────────

describe('computeAlertPrioritySignal() — unit', () => {
  it('critical severity + recent alert scores highest', () => {
    const alert = { severity: 'critical', resolved: false, createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) };
    const r = computeAlertPrioritySignal(alert, { now: NOW });
    expect(r.priorityScore).toBe(100);
    expect(r.priorityLabel).toBe('critical');
    expect(r.priorityReasons.length).toBeGreaterThan(0);
  });

  it('high severity within 24h scores 80', () => {
    const alert = { severity: 'high', resolved: false, createdAt: new Date(NOW.getTime() - 12 * 60 * 60 * 1000) };
    const r = computeAlertPrioritySignal(alert, { now: NOW });
    expect(r.priorityScore).toBe(80);
    expect(r.priorityLabel).toBe('critical');
  });

  it('low severity old alert scores low', () => {
    const alert = { severity: 'low', resolved: false, createdAt: new Date(NOW.getTime() - 200 * 24 * 60 * 60 * 1000) };
    const r = computeAlertPrioritySignal(alert, { now: NOW });
    expect(r.priorityScore).toBe(20);
    expect(r.priorityLabel).toBe('low');
  });

  it('resolved alert includes resolved reason', () => {
    const alert = { severity: 'high', resolved: true, createdAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000) };
    const r = computeAlertPrioritySignal(alert, { now: NOW });
    expect(r.priorityReasons.some(s => /resolved/.test(s))).toBe(true);
  });

  it('score is clamped to maximum 100', () => {
    const alert = { severity: 'critical', resolved: false, createdAt: new Date(NOW.getTime() - 1 * 60 * 60 * 1000) };
    const r = computeAlertPrioritySignal(alert, { now: NOW });
    expect(r.priorityScore).toBeLessThanOrEqual(100);
  });
});

// ── Integration setup ─────────────────────────────────────────────────────────

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 600000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
  const hash = await bcrypt.hash('AdminPass123!', 4);
  await User.create({ email: 'admin@test.com', password: hash, role: 'admin' });
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'AdminPass123!' });
  adminToken = res.body.data.token;
});

function makeObs(overrides = {}) {
  return {
    clientId:    `obs-${Math.random().toString(36).slice(2)}`,
    householdId: 'HH-001',
    testType:    'TDS',
    result:      200,
    testedAt:    new Date(),
    wardId:      'ward-01',
    ...overrides,
  };
}

// ── Data Quality Dashboard ────────────────────────────────────────────────────

describe('GET /api/analytics/data-quality', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/analytics/data-quality');
    expect(res.status).toBe(401);
  });

  it('returns zeros when no observations exist', async () => {
    const res = await request(app)
      .get('/api/analytics/data-quality')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalObservations).toBe(0);
    expect(res.body.data.missingLocationCount).toBe(0);
  });

  it('counts observations missing GPS location', async () => {
    await Observation.create(makeObs()); // no location
    await Observation.create(makeObs({
      location: { type: 'Point', coordinates: [76.2673, 9.9312] },
    }));

    const res = await request(app)
      .get('/api/analytics/data-quality')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalObservations).toBe(2);
    expect(res.body.data.missingLocationCount).toBe(1);
  });

  it('counts stale observations (> 90 days old)', async () => {
    const staleDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await Observation.create(makeObs({ testedAt: staleDate }));
    await Observation.create(makeObs({ testedAt: new Date() }));

    const res = await request(app)
      .get('/api/analytics/data-quality')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.staleCount).toBe(1);
    expect(res.body.data.coverageGaps).toHaveProperty('stalePct');
  });

  it('counts implausible results (TDS > 5000)', async () => {
    await Observation.create(makeObs({ testType: 'TDS', result: 9999 }));
    await Observation.create(makeObs({ testType: 'TDS', result: 300 }));

    const res = await request(app)
      .get('/api/analytics/data-quality')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.implausibleCount).toBe(1);
  });
});

// ── Anomaly Detection ─────────────────────────────────────────────────────────

describe('GET /api/analytics/anomaly', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/analytics/anomaly');
    expect(res.status).toBe(401);
  });

  it('returns anomalyDetected=false with insufficient baseline data', async () => {
    // Only 2 observations in the baseline window — below minimum of 3
    const baseDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Observation.create(makeObs({ testedAt: baseDate, result: 600 }));
    await Observation.create(makeObs({ testedAt: baseDate, result: 600 }));

    const res = await request(app)
      .get('/api/analytics/anomaly?wardId=ward-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.anomalyDetected).toBe(false);
    expect(typeof res.body.data.reason).toBe('string');
  });

  it('returns anomalyDetected=true when recent rate is significantly above baseline', async () => {
    // Baseline window (8-90 days ago): mostly passing
    for (let i = 10; i <= 30; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      await Observation.create(makeObs({ testedAt: d, result: 200 })); // passing TDS
    }
    // Recent window (last 7 days): all failing
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      await Observation.create(makeObs({ testedAt: d, result: 800 })); // failing TDS > 500
    }

    const res = await request(app)
      .get('/api/analytics/anomaly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.anomalyDetected).toBe(true);
    expect(res.body.data.anomalyType).toBe('contamination_spike');
    expect(typeof res.body.data.explanation).toBe('string');
    expect(typeof res.body.data.recentRate).toBe('number');
    expect(typeof res.body.data.baselineRate).toBe('number');
  });

  it('returns anomalyDetected=false when rates are within normal range', async () => {
    // Both windows have similar contamination rates
    for (let i = 10; i <= 30; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      await Observation.create(makeObs({ testedAt: d, result: 600 })); // failing
    }
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      await Observation.create(makeObs({ testedAt: d, result: 600 })); // also failing
    }

    const res = await request(app)
      .get('/api/analytics/anomaly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.anomalyDetected).toBe(false);
  });
});

// ── Field Task Suggestion ─────────────────────────────────────────────────────

describe('GET /api/field-tasks/suggest', () => {
  it('returns 400 when wardId is missing', async () => {
    const res = await request(app).get('/api/field-tasks/suggest');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/wardId/);
  });

  it('returns suggestion=null when fewer than 3 recent failures exist', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await Observation.create(makeObs({ wardId: 'ward-01', result: 800, testedAt: recent }));
    await Observation.create(makeObs({ wardId: 'ward-01', result: 800, testedAt: recent }));

    const res = await request(app).get('/api/field-tasks/suggest?wardId=ward-01');
    expect(res.status).toBe(200);
    expect(res.body.data.suggestion).toBeNull();
  });

  it('returns a suggestion when 3+ recent failures exist', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 4; i++) {
      await Observation.create(makeObs({ wardId: 'ward-01', result: 800, testedAt: recent }));
    }

    const res = await request(app).get('/api/field-tasks/suggest?wardId=ward-01');
    expect(res.status).toBe(200);
    const { suggestion } = res.body.data;
    expect(suggestion).not.toBeNull();
    expect(typeof suggestion.title).toBe('string');
    expect(suggestion.wardId).toBe('ward-01');
    expect(['low', 'medium', 'high', 'critical']).toContain(suggestion.priority);
    expect(typeof suggestion.sourceObservationId).toBe('string');
    expect(typeof suggestion.suggestedAction).toBe('string');
  });

  it('does not create a task — suggestion only', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 4; i++) {
      await Observation.create(makeObs({ wardId: 'ward-02', result: 800, testedAt: recent }));
    }
    await request(app).get('/api/field-tasks/suggest?wardId=ward-02');

    const tasks = await request(app).get('/api/field-tasks?wardId=ward-02');
    expect(tasks.body.data.tasks).toHaveLength(0);
  });
});
