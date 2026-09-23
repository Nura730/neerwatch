/**
 * NeerWatch API integration tests.
 * Uses mongodb-memory-server so no external MongoDB is required.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request  = require('supertest');
const app      = require('../src/app');

let mongoServer;

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
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
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
// Health (Phase 1 — must still pass)
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
    const res = await request(app).post('/api/tests').send(validObs());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.clientId).toBe('client-001');
    expect(res.body.data.location).toEqual({ lat: 8.5241, lng: 76.9366 });
    expect(res.body.data).not.toHaveProperty('_id');
  });

  it('creates observation without location', async () => {
    const res = await request(app).post('/api/tests').send(validObs({ location: undefined, clientId: 'client-002' }));
    expect(res.status).toBe(201);
    expect(res.body.data.location).toBeNull();
  });

  it('returns 400 when testType is invalid', async () => {
    const res = await request(app).post('/api/tests').send(validObs({ testType: 'unknown' }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/testType/);
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app).post('/api/tests').send(validObs({ wardId: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when result is not a number', async () => {
    const res = await request(app).post('/api/tests').send(validObs({ result: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when location.lat is out of range', async () => {
    const res = await request(app).post('/api/tests').send(validObs({ location: { lat: 200, lng: 76.9 } }));
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate clientId', async () => {
    await request(app).post('/api/tests').send(validObs());
    const res = await request(app).post('/api/tests').send(validObs());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/tests
// ---------------------------------------------------------------------------
describe('GET /api/tests', () => {
  beforeEach(async () => {
    await request(app).post('/api/tests').send(validObs({ clientId: 'c1' }));
    await request(app).post('/api/tests').send(validObs({ clientId: 'c2', wardId: 'ward-02' }));
  });

  it('returns paginated observations', async () => {
    const res = await request(app).get('/api/tests');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.observations).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(20);
  });

  it('filters by wardId', async () => {
    const res = await request(app).get('/api/tests?wardId=ward-02');
    expect(res.body.data.observations).toHaveLength(1);
    expect(res.body.data.observations[0].wardId).toBe('ward-02');
  });

  it('respects page and limit', async () => {
    const res = await request(app).get('/api/tests?page=1&limit=1');
    expect(res.body.data.observations).toHaveLength(1);
    expect(res.body.data.total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/tests/map
// ---------------------------------------------------------------------------
describe('GET /api/tests/map', () => {
  beforeEach(async () => {
    await request(app).post('/api/tests').send(validObs({ clientId: 'with-loc' }));
    await request(app).post('/api/tests').send(validObs({ clientId: 'no-loc', location: undefined }));
  });

  it('returns only observations with location', async () => {
    const res = await request(app).get('/api/tests/map');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const obs = res.body.data.observations;
    expect(obs).toHaveLength(1);
    expect(obs[0].location).not.toBeNull();
    expect(obs[0].location).toHaveProperty('lat');
    expect(obs[0].location).toHaveProperty('lng');
  });
});

// ---------------------------------------------------------------------------
// POST /api/tests/sync
// ---------------------------------------------------------------------------
describe('POST /api/tests/sync', () => {
  it('inserts new observations and skips duplicates', async () => {
    // Pre-insert one
    await request(app).post('/api/tests').send(validObs({ clientId: 'dup-01' }));

    const res = await request(app).post('/api/tests/sync').send({
      observations: [
        validObs({ clientId: 'dup-01' }),            // duplicate
        validObs({ clientId: 'new-01' }),            // new
        validObs({ clientId: 'new-02', wardId: 'ward-02' }), // new
        { clientId: 'bad' },                         // invalid
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processed).toBe(4);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.duplicates).toBe(1);
    expect(res.body.data.failed).toBe(1);
  });

  it('returns 400 when observations is not an array', async () => {
    const res = await request(app).post('/api/tests/sync').send({ observations: 'bad' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard
// ---------------------------------------------------------------------------
describe('GET /api/dashboard', () => {
  it('returns the required dashboard fields', async () => {
    await request(app).post('/api/tests').send(validObs({ clientId: 'd1', result: 620 })); // failing TDS
    await request(app).post('/api/tests').send(validObs({ clientId: 'd2', result: 200 })); // passing

    const res = await request(app).get('/api/dashboard');
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

    const res = await request(app).get('/api/clusters');
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

    const res = await request(app).get('/api/clusters?active=true');
    expect(res.body.data.clusters).toHaveLength(0);
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

    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const a = res.body.data.alerts[0];
    expect(a).toHaveProperty('id');
    expect(a).not.toHaveProperty('_id');
    expect(a.severity).toBe('high');
    expect(a.resolved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/wards
// ---------------------------------------------------------------------------
describe('GET /api/wards', () => {
  it('returns ward aggregation', async () => {
    await request(app).post('/api/tests').send(validObs({ clientId: 'wr1', result: 620 })); // failing
    await request(app).post('/api/tests').send(validObs({ clientId: 'wr2', result: 200 })); // passing

    const res = await request(app).get('/api/wards');
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
});

// ---------------------------------------------------------------------------
// GET /api/rainfall
// ---------------------------------------------------------------------------
describe('GET /api/rainfall', () => {
  it('returns rainfall data', async () => {
    const Rainfall = require('../src/models/Rainfall');
    await Rainfall.create({ wardId: 'ward-01', rainfallMm: 12.4, recordedAt: new Date('2024-03-15') });

    const res = await request(app).get('/api/rainfall');
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

    const res = await request(app).get('/api/rainfall?wardId=ward-02');
    expect(res.body.data.rainfall).toHaveLength(1);
    expect(res.body.data.rainfall[0].wardId).toBe('ward-02');
  });
});
