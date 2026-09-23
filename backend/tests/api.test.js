/**
 * NeerWatch API integration tests.
 * Uses mongodb-memory-server so no external MongoDB is required.
 *
 * JWT_SECRET and BCRYPT_ROUNDS must be set before app is loaded so that
 * requireAuth works and bcrypt hashing is fast in tests.
 */

// Set auth env vars before any module is required
process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/User');

let mongoServer;
let adminToken; // used by all existing tests — admin has full access

// mongodb-memory-server downloads a MongoDB binary on first run (~600MB).
// The 600s timeout covers the initial download; subsequent runs use the cache.
jest.setTimeout(600000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 600000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  // Wipe all collections for test isolation
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
  // Re-create admin user and get a fresh token each test
  const hash = await bcrypt.hash('AdminPass123!', 4);
  await User.create({ email: 'admin@test.com', password: hash, role: 'admin' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminPass123!' });
  adminToken = res.body.data.token;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const validObs = (overrides = {}) => ({
  clientId:    'client-001',
  householdId: 'HH-001',
  testType:    'TDS',
  result:      320,
  testedAt:    '2024-03-15T09:00:00.000Z',
  location:    { lat: 8.5241, lng: 76.9366 },
  wardId:      'ward-01',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Health (Phase 1 — must still pass; /health is public, no auth required)
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('returns 200 with success structure', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });
});

// ---------------------------------------------------------------------------
// POST /api/tests
// ---------------------------------------------------------------------------
describe('POST /api/tests', () => {
  it('creates a valid observation and returns 201', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.clientId).toBe('client-001');
    expect(res.body.data.location).toEqual({ lat: 8.5241, lng: 76.9366 });
    expect(res.body.data).not.toHaveProperty('_id');
  });

  it('creates observation without location', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ location: undefined, clientId: 'client-002' }));
    expect(res.status).toBe(201);
    expect(res.body.data.location).toBeNull();
  });

  it('returns 400 when testType is invalid', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ testType: 'unknown' }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/testType/);
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ wardId: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when result is not a number', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ result: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when location.lat is out of range', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs({ location: { lat: 200, lng: 76.9 } }));
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate clientId', async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs());
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/tests').send(validObs());
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/tests
// ---------------------------------------------------------------------------
describe('GET /api/tests', () => {
  beforeEach(async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'c1' }));
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'c2', wardId: 'ward-02' }));
  });

  it('returns paginated observations', async () => {
    const res = await request(app).get('/api/tests').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.observations).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(20);
  });

  it('filters by wardId', async () => {
    const res = await request(app).get('/api/tests?wardId=ward-02').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.observations).toHaveLength(1);
    expect(res.body.data.observations[0].wardId).toBe('ward-02');
  });

  it('respects page and limit', async () => {
    const res = await request(app).get('/api/tests?page=1&limit=1').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.observations).toHaveLength(1);
    expect(res.body.data.total).toBe(2);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/tests');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/tests/map
// ---------------------------------------------------------------------------
describe('GET /api/tests/map', () => {
  beforeEach(async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'with-loc' }));
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'no-loc', location: undefined }));
  });

  it('returns only observations with location', async () => {
    const res = await request(app).get('/api/tests/map').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const obs = res.body.data.observations;
    expect(obs).toHaveLength(1);
    expect(obs[0].location).not.toBeNull();
    expect(obs[0].location).toHaveProperty('lat');
    expect(obs[0].location).toHaveProperty('lng');
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/tests/map');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/tests/sync
// ---------------------------------------------------------------------------
describe('POST /api/tests/sync', () => {
  it('inserts new observations and skips duplicates', async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'dup-01' }));

    const res = await request(app)
      .post('/api/tests/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        observations: [
          validObs({ clientId: 'dup-01' }),
          validObs({ clientId: 'new-01' }),
          validObs({ clientId: 'new-02', wardId: 'ward-02' }),
          { clientId: 'bad' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processed).toBe(4);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.duplicates).toBe(1);
    expect(res.body.data.failed).toBe(1);

    const results = res.body.data.results;
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(4);
    expect(results.find(r => r.clientId === 'dup-01').status).toBe('duplicate');
    expect(results.find(r => r.clientId === 'new-01').status).toBe('created');
    expect(results.find(r => r.clientId === 'new-02').status).toBe('created');
    expect(results.find(r => r.clientId === 'bad').status).toBe('failed');
  });

  it('returns 400 when observations is not an array', async () => {
    const res = await request(app)
      .post('/api/tests/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ observations: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/tests/sync').send({ observations: [] });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard
// ---------------------------------------------------------------------------
describe('GET /api/dashboard', () => {
  it('returns the required dashboard fields', async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'd1', result: 620 }));
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'd2', result: 200 }));

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty('totalTests');
    expect(d).toHaveProperty('positiveTests');
    expect(d).toHaveProperty('activeClusters');
    expect(d).toHaveProperty('pendingSync');
    expect(d).toHaveProperty('missingLocations');
    expect(d.totalTests).toBe(2);
    expect(d.positiveTests).toBe(1);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/clusters
// ---------------------------------------------------------------------------
describe('GET /api/clusters', () => {
  it('returns clusters with public id field', async () => {
    const Cluster = require('../src/models/Cluster');
    await Cluster.create({
      testType: 'TDS',
      centroid: { type: 'Point', coordinates: [76.9366, 8.5241] },
      radiusMetres: 500,
      observationCount: 4,
      failureRate: 0.8,
      windowStart: new Date('2024-03-08'),
      windowEnd:   new Date('2024-03-15'),
      wardId: 'ward-01',
      detectedAt: new Date('2024-03-15'),
      active: true,
    });

    const res = await request(app).get('/api/clusters').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const c = res.body.data.clusters[0];
    expect(c).toHaveProperty('id');
    expect(c).not.toHaveProperty('_id');
    expect(c.centroid).toEqual({ lat: 8.5241, lng: 76.9366 });
    expect(c.active).toBe(true);
  });

  it('filters by active=true', async () => {
    const Cluster = require('../src/models/Cluster');
    await Cluster.create({
      testType: 'pH', centroid: { type: 'Point', coordinates: [76.9, 8.5] },
      radiusMetres: 500, observationCount: 3, failureRate: 1,
      windowStart: new Date(), windowEnd: new Date(),
      wardId: 'ward-02', detectedAt: new Date(), active: false,
    });

    const res = await request(app).get('/api/clusters?active=true').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.clusters).toHaveLength(0);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/clusters');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/alerts
// ---------------------------------------------------------------------------
describe('GET /api/alerts', () => {
  it('returns alerts with public id and no _id', async () => {
    const Cluster = require('../src/models/Cluster');
    const Alert   = require('../src/models/Alert');

    const cluster = await Cluster.create({
      testType: 'TDS', centroid: { type: 'Point', coordinates: [76.9366, 8.5241] },
      radiusMetres: 500, observationCount: 3, failureRate: 1,
      windowStart: new Date(), windowEnd: new Date(),
      wardId: 'ward-01', detectedAt: new Date(), active: true,
    });

    await Alert.create({
      clusterId: cluster._id,
      severity:  'high',
      message:   'Test alert for ward-01',
      wardId:    'ward-01',
      resolved:  false,
    });

    const res = await request(app).get('/api/alerts').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const a = res.body.data.alerts[0];
    expect(a).toHaveProperty('id');
    expect(a).not.toHaveProperty('_id');
    expect(a.severity).toBe('high');
    expect(a.resolved).toBe(false);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/wards
// ---------------------------------------------------------------------------
describe('GET /api/wards', () => {
  it('returns ward aggregation', async () => {
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'wr1', result: 620 }));
    await request(app).post('/api/tests').set('Authorization', `Bearer ${adminToken}`).send(validObs({ clientId: 'wr2', result: 200 }));

    const res = await request(app).get('/api/wards').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const w = res.body.data.wards[0];
    expect(w).toHaveProperty('wardId');
    expect(w).toHaveProperty('totalTests');
    expect(w).toHaveProperty('passCount');
    expect(w).toHaveProperty('failCount');
    expect(w).toHaveProperty('failureRate');
    expect(w.totalTests).toBe(2);
    expect(w.failCount).toBe(1);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/wards');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/rainfall
// ---------------------------------------------------------------------------
describe('GET /api/rainfall', () => {
  it('returns rainfall data', async () => {
    const Rainfall = require('../src/models/Rainfall');
    await Rainfall.create({ wardId: 'ward-01', rainfallMm: 12.4, recordedAt: new Date('2024-03-15') });

    const res = await request(app).get('/api/rainfall').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rainfall[0]).toMatchObject({ wardId: 'ward-01', rainfallMm: 12.4 });
  });

  it('filters by wardId', async () => {
    const Rainfall = require('../src/models/Rainfall');
    await Rainfall.insertMany([
      { wardId: 'ward-01', rainfallMm: 5.0, recordedAt: new Date('2024-03-15') },
      { wardId: 'ward-02', rainfallMm: 3.0, recordedAt: new Date('2024-03-15') },
    ]);

    const res = await request(app).get('/api/rainfall?wardId=ward-02').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.rainfall).toHaveLength(1);
    expect(res.body.data.rainfall[0].wardId).toBe('ward-02');
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/rainfall');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid date parameter validation (P2-8)
// ---------------------------------------------------------------------------
describe('Date parameter validation', () => {
  it('GET /api/tests?from=invalid returns 400', async () => {
    const res = await request(app)
      .get('/api/tests?from=invalid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('GET /api/tests?to=garbage returns 400', async () => {
    const res = await request(app)
      .get('/api/tests?to=garbage')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/tests/map?from=invalid returns 400', async () => {
    const res = await request(app)
      .get('/api/tests/map?from=invalid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/rainfall?from=invalid returns 400', async () => {
    const Rainfall = require('../src/models/Rainfall');
    await Rainfall.create({ wardId: 'ward-01', rainfallMm: 5.0, recordedAt: new Date('2024-03-15') });

    const res = await request(app)
      .get('/api/rainfall?from=invalid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
