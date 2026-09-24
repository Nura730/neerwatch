/**
 * Contamination-trend analytics integration tests.
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/User');
const Observation = require('../src/models/Observation');

jest.setTimeout(600000);

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

// Helper: insert observations directly into DB for speed
function makeObs(overrides) {
  return {
    clientId:    `obs-${Math.random().toString(36).slice(2)}`,
    householdId: 'HH-001',
    testType:    'TDS',
    result:      200,       // passing (TDS ≤ 500)
    testedAt:    new Date('2024-03-15T09:00:00.000Z'),
    wardId:      'ward-01',
    ...overrides,
  };
}

async function insertObs(overrides) {
  return Observation.create(makeObs(overrides));
}

describe('GET /api/analytics/contamination-trend', () => {

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/analytics/contamination-trend');
    expect(res.status).toBe(401);
  });

  it('returns correct shape', async () => {
    await insertObs({ testedAt: new Date('2024-03-15') });
    const res = await request(app)
      .get('/api/analytics/contamination-trend')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty('interval');
    expect(d).toHaveProperty('series');
    expect(Array.isArray(d.series)).toBe(true);
    if (d.series.length > 0) {
      const s = d.series[0];
      expect(s).toHaveProperty('period');
      expect(s).toHaveProperty('totalTests');
      expect(s).toHaveProperty('positiveTests');
      expect(s).toHaveProperty('positiveRate');
    }
  });

  it('empty dataset returns empty series', async () => {
    const res = await request(app)
      .get('/api/analytics/contamination-trend')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.series).toHaveLength(0);
  });

  it('daily aggregation groups by YYYY-MM-DD', async () => {
    await insertObs({ testedAt: new Date('2024-03-10T08:00:00Z'), result: 200 });
    await insertObs({ testedAt: new Date('2024-03-10T14:00:00Z'), result: 600 }); // failing
    await insertObs({ testedAt: new Date('2024-03-11T09:00:00Z'), result: 200 });

    const res = await request(app)
      .get('/api/analytics/contamination-trend?interval=day')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { series } = res.body.data;
    expect(series).toHaveLength(2);

    const mar10 = series.find((s) => s.period === '2024-03-10');
    expect(mar10).toBeDefined();
    expect(mar10.totalTests).toBe(2);
    expect(mar10.positiveTests).toBe(1);
    expect(mar10.positiveRate).toBe(50);

    const mar11 = series.find((s) => s.period === '2024-03-11');
    expect(mar11.totalTests).toBe(1);
    expect(mar11.positiveTests).toBe(0);
    expect(mar11.positiveRate).toBe(0);
  });

  it('monthly aggregation groups by YYYY-MM', async () => {
    await insertObs({ testedAt: new Date('2024-01-05'), result: 600 }); // Jan, failing
    await insertObs({ testedAt: new Date('2024-01-20'), result: 200 }); // Jan, passing
    await insertObs({ testedAt: new Date('2024-02-10'), result: 600 }); // Feb, failing
    await insertObs({ testedAt: new Date('2024-02-15'), result: 600 }); // Feb, failing

    const res = await request(app)
      .get('/api/analytics/contamination-trend?interval=month')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { series } = res.body.data;
    expect(series).toHaveLength(2);

    const jan = series.find((s) => s.period === '2024-01');
    expect(jan.totalTests).toBe(2);
    expect(jan.positiveTests).toBe(1);
    expect(jan.positiveRate).toBe(50);

    const feb = series.find((s) => s.period === '2024-02');
    expect(feb.totalTests).toBe(2);
    expect(feb.positiveTests).toBe(2);
    expect(feb.positiveRate).toBe(100);
  });

  it('weekly aggregation groups by YYYY-WNN', async () => {
    // ISO week 2024-W11 = 11–17 Mar 2024
    await insertObs({ testedAt: new Date('2024-03-11'), result: 600 }); // W11, failing
    await insertObs({ testedAt: new Date('2024-03-12'), result: 200 }); // W11, passing
    // ISO week 2024-W12 = 18–24 Mar 2024
    await insertObs({ testedAt: new Date('2024-03-18'), result: 200 }); // W12, passing

    const res = await request(app)
      .get('/api/analytics/contamination-trend?interval=week')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { series } = res.body.data;
    expect(series).toHaveLength(2);

    const w11 = series.find((s) => s.period === '2024-W11');
    expect(w11).toBeDefined();
    expect(w11.totalTests).toBe(2);
    expect(w11.positiveTests).toBe(1);

    const w12 = series.find((s) => s.period === '2024-W12');
    expect(w12).toBeDefined();
    expect(w12.totalTests).toBe(1);
    expect(w12.positiveTests).toBe(0);
  });

  it('wardId filter limits results to one ward', async () => {
    await insertObs({ wardId: 'ward-01', result: 600, testedAt: new Date('2024-03-10') });
    await insertObs({ wardId: 'ward-02', result: 600, testedAt: new Date('2024-03-10') });

    const res = await request(app)
      .get('/api/analytics/contamination-trend?wardId=ward-01&interval=day')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.wardId).toBe('ward-01');
    const { series } = res.body.data;
    expect(series).toHaveLength(1);
    expect(series[0].totalTests).toBe(1);
  });

  it('testType filter limits results to one test type', async () => {
    await insertObs({ testType: 'TDS', result: 600, testedAt: new Date('2024-03-10') });
    await insertObs({ testType: 'pH',  result: 7.0, testedAt: new Date('2024-03-10') }); // passing pH

    const res = await request(app)
      .get('/api/analytics/contamination-trend?testType=TDS&interval=day')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.testType).toBe('TDS');
    const { series } = res.body.data;
    expect(series[0].totalTests).toBe(1);
    expect(series[0].positiveTests).toBe(1);
  });

  it('date filter (from/to) restricts the window', async () => {
    await insertObs({ testedAt: new Date('2024-01-01') });
    await insertObs({ testedAt: new Date('2024-03-15') });
    await insertObs({ testedAt: new Date('2024-06-01') });

    const res = await request(app)
      .get('/api/analytics/contamination-trend?from=2024-02-01&to=2024-04-30&interval=month')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.series).toHaveLength(1);
    expect(res.body.data.series[0].period).toBe('2024-03');
  });

  it('returns 400 for invalid from date', async () => {
    const res = await request(app)
      .get('/api/analytics/contamination-trend?from=not-a-date')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid to date', async () => {
    const res = await request(app)
      .get('/api/analytics/contamination-trend?to=garbage')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('zero-test period with 0 positiveRate — no divide-by-zero', async () => {
    // Only passing observations — positiveRate should be 0, not NaN
    await insertObs({ result: 200, testedAt: new Date('2024-03-10') });
    const res = await request(app)
      .get('/api/analytics/contamination-trend?interval=day')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.series[0].positiveRate).toBe(0);
    expect(isNaN(res.body.data.series[0].positiveRate)).toBe(false);
  });

  it('positiveRate is correctly computed across test types', async () => {
    // TDS > 500 is failing; coliform > 0 is failing
    await insertObs({ testType: 'TDS',      result: 600, testedAt: new Date('2024-03-10') }); // fail
    await insertObs({ testType: 'TDS',      result: 200, testedAt: new Date('2024-03-10') }); // pass
    await insertObs({ testType: 'coliform', result: 5,   testedAt: new Date('2024-03-10') }); // fail
    await insertObs({ testType: 'coliform', result: 0,   testedAt: new Date('2024-03-10') }); // pass

    const res = await request(app)
      .get('/api/analytics/contamination-trend?interval=day')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const s = res.body.data.series[0];
    expect(s.totalTests).toBe(4);
    expect(s.positiveTests).toBe(2);
    expect(s.positiveRate).toBe(50);
  });

  it('defaults interval to day when not specified', async () => {
    await insertObs({ testedAt: new Date('2024-03-15') });
    const res = await request(app)
      .get('/api/analytics/contamination-trend')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.interval).toBe('day');
    // period format should be YYYY-MM-DD
    if (res.body.data.series.length > 0) {
      expect(res.body.data.series[0].period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
