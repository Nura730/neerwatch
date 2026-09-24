/**
 * Confidence scoring — unit tests for computeConfidence() and
 * integration tests for GET /api/tests/:id/confidence.
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/User');
const { computeConfidence } = require('../src/services/confidenceScoring');

jest.setTimeout(600000);

// Fixed "now" — 5 days after the base observation date → daysOld ≈ 5 → fresh
const NOW  = new Date('2024-03-20T00:00:00.000Z');
const BASE = {
  clientId:    'c1',
  householdId: 'HH-001',
  testType:    'TDS',
  result:      320,
  testedAt:    new Date('2024-03-15T09:00:00.000Z'),
  location:    { lat: 8.5241, lng: 76.9366 },
  wardId:      'ward-01',
};

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests — computeConfidence()
// ──────────────────────────────────────────────────────────────────────────────

describe('computeConfidence() — unit', () => {
  it('complete high-quality observation scores 100 and returns high level', () => {
    const r = computeConfidence(BASE, { now: NOW });
    expect(r.confidenceScore).toBe(100);
    expect(r.confidenceLevel).toBe('high');
    expect(r.confidenceReasons).toHaveLength(0);
    expect(r.confidenceFactors.hasLocation).toBe(true);
    expect(r.confidenceFactors.requiredFieldsComplete).toBe(true);
    expect(r.confidenceFactors.resultPlausibility).toBe('plausible');
    expect(r.confidenceFactors.dateValidity).toBe('fresh');
    expect(r.confidenceFactors.duplicateSignal).toBe(false);
  });

  it('missing location deducts 15 points', () => {
    const r = computeConfidence({ ...BASE, location: null }, { now: NOW });
    expect(r.confidenceScore).toBe(85);
    expect(r.confidenceLevel).toBe('high');
    expect(r.confidenceFactors.hasLocation).toBe(false);
    expect(r.confidenceReasons).toContainEqual(expect.stringMatching(/GPS location missing/));
  });

  it('stale observation (> 90 days old) scores 75 — medium', () => {
    const staleDate = new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
    const r = computeConfidence({ ...BASE, testedAt: staleDate }, { now: NOW });
    expect(r.confidenceScore).toBe(75);
    expect(r.confidenceLevel).toBe('medium');
    expect(r.confidenceFactors.dateValidity).toBe('stale');
    expect(r.confidenceReasons.some((s) => /90 days/.test(s))).toBe(true);
  });

  it('aging observation (30-90 days) scores 85', () => {
    const agingDate = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000);
    const r = computeConfidence({ ...BASE, testedAt: agingDate }, { now: NOW });
    expect(r.confidenceScore).toBe(85);
    expect(r.confidenceFactors.dateValidity).toBe('aging');
  });

  it('recent observation (7-30 days) scores 95', () => {
    const recentDate = new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1000);
    const r = computeConfidence({ ...BASE, testedAt: recentDate }, { now: NOW });
    expect(r.confidenceScore).toBe(95);
    expect(r.confidenceFactors.dateValidity).toBe('recent');
  });

  it('future testedAt gives dateValidity=future and penalises score', () => {
    const futureDate = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    const r = computeConfidence({ ...BASE, testedAt: futureDate }, { now: NOW });
    // loses 10 (not-future) + 25 (recency) = 35 pts → 65
    expect(r.confidenceScore).toBe(65);
    expect(r.confidenceLevel).toBe('medium');
    expect(r.confidenceFactors.dateValidity).toBe('future');
    expect(r.confidenceReasons.some((s) => /future/.test(s))).toBe(true);
  });

  it('implausible result (TDS > 5000) deducts 20 points', () => {
    const r = computeConfidence({ ...BASE, result: 9999 }, { now: NOW });
    expect(r.confidenceScore).toBe(80);
    expect(r.confidenceFactors.resultPlausibility).toBe('implausible');
    expect(r.confidenceReasons.some((s) => /plausible/.test(s))).toBe(true);
  });

  it('duplicate signal deducts 20 points', () => {
    const r = computeConfidence(BASE, { now: NOW, isDuplicate: true });
    expect(r.confidenceScore).toBe(80);
    expect(r.confidenceFactors.duplicateSignal).toBe(true);
    expect(r.confidenceReasons.some((s) => /duplicate/.test(s))).toBe(true);
  });

  it('invalid/incomplete observation (missing required fields + all penalties) scores 0 — low', () => {
    // householdId and wardId null → requiredFields fails
    // TDS 99999 → implausible (bounds check fires because testType is known)
    // future testedAt → loses recency points
    // no location, duplicate signal
    const bad = {
      testType:    'TDS',
      result:      99999,                              // implausible
      testedAt:    new Date(NOW.getTime() + 86400000), // future
      location:    null,
      householdId: null,                              // missing required
      wardId:      null,
    };
    const r = computeConfidence(bad, { now: NOW, isDuplicate: true });
    expect(r.confidenceScore).toBe(0);
    expect(r.confidenceLevel).toBe('low');
  });

  it('score is clamped to minimum 0 even with excessive deductions', () => {
    const worst = {
      testType:    'TDS',
      result:      99999,
      testedAt:    new Date(NOW.getTime() + 86400000),
      location:    null,
      householdId: null,
      wardId:      null,
    };
    const r = computeConfidence(worst, { now: NOW, isDuplicate: true });
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(r.confidenceScore).toBe(0);
  });

  it('score is clamped to maximum 100', () => {
    const r = computeConfidence(BASE, { now: NOW });
    expect(r.confidenceScore).toBeLessThanOrEqual(100);
    expect(r.confidenceScore).toBe(100);
  });

  it('pH implausibility detected (pH 15 is impossible)', () => {
    const r = computeConfidence({ ...BASE, testType: 'pH', result: 15 }, { now: NOW });
    expect(r.confidenceFactors.resultPlausibility).toBe('implausible');
  });

  it('coliform implausibility detected (negative count is impossible)', () => {
    const r = computeConfidence({ ...BASE, testType: 'coliform', result: -5 }, { now: NOW });
    expect(r.confidenceFactors.resultPlausibility).toBe('implausible');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Integration tests — GET /api/tests/:id/confidence
// ──────────────────────────────────────────────────────────────────────────────

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
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminPass123!' });
  adminToken = res.body.data.token;
});

const validObs = (overrides = {}) => ({
  clientId:    'conf-001',
  householdId: 'HH-CONF',
  testType:    'TDS',
  result:      320,
  testedAt:    '2024-03-15T09:00:00.000Z',
  location:    { lat: 8.5241, lng: 76.9366 },
  wardId:      'ward-01',
  ...overrides,
});

describe('GET /api/tests/:id/confidence', () => {
  it('returns confidence shape for a valid observation', async () => {
    const created = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs());
    expect(created.status).toBe(201);

    // Need the MongoDB _id — fetch from list
    const list = await request(app).get('/api/tests');
    const id = list.body.data.observations[0].clientId; // use clientId to find via separate list call

    // Actually let's get id from a direct DB lookup via the list response structure.
    // The list response doesn't return _id; we need to query by clientId.
    const Observation = require('../src/models/Observation');
    const doc = await Observation.findOne({ clientId: 'conf-001' });

    const res = await request(app).get(`/api/tests/${doc._id}/confidence`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(typeof d.confidenceScore).toBe('number');
    expect(['low', 'medium', 'high']).toContain(d.confidenceLevel);
    expect(typeof d.confidenceFactors).toBe('object');
    expect(Array.isArray(d.confidenceReasons)).toBe(true);
    expect(d.confidenceFactors).toHaveProperty('hasLocation');
    expect(d.confidenceFactors).toHaveProperty('duplicateSignal');
    expect(d.confidenceFactors).toHaveProperty('resultPlausibility');
    expect(d.confidenceFactors).toHaveProperty('dateValidity');
  });

  it('returns 400 for an invalid id format', async () => {
    const res = await request(app).get('/api/tests/not-an-id/confidence');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent observation', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/tests/${fakeId}/confidence`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('detects duplicate signal when same household tests same type within 1 hour', async () => {
    const testedAt = '2024-03-15T09:00:00.000Z';
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ clientId: 'dup-a', testedAt }));
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ clientId: 'dup-b', testedAt: '2024-03-15T09:30:00.000Z' }));

    const Observation = require('../src/models/Observation');
    const doc = await Observation.findOne({ clientId: 'dup-a' });
    const res = await request(app).get(`/api/tests/${doc._id}/confidence`);
    expect(res.status).toBe(200);
    expect(res.body.data.confidenceFactors.duplicateSignal).toBe(true);
  });

  it('confidence is embedded in GET /api/tests list response', async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`)
      .send(validObs());
    const res = await request(app).get('/api/tests');
    expect(res.status).toBe(200);
    const obs = res.body.data.observations[0];
    expect(typeof obs.confidenceScore).toBe('number');
    expect(['low', 'medium', 'high']).toContain(obs.confidenceLevel);
    expect(typeof obs.confidenceFactors).toBe('object');
    expect(Array.isArray(obs.confidenceReasons)).toBe(true);
  });

  it('confidence is embedded in GET /api/tests/map response', async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`)
      .send(validObs());
    const res = await request(app).get('/api/tests/map');
    expect(res.status).toBe(200);
    const obs = res.body.data.observations[0];
    expect(typeof obs.confidenceScore).toBe('number');
    expect(obs.confidenceFactors.hasLocation).toBe(true);
  });
});
