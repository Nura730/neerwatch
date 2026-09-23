/**
 * Alert lifecycle integration tests.
 *
 * Covers PATCH /api/alerts/:id/resolve and interaction with GET /api/alerts.
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/User');
const Alert    = require('../src/models/Alert');
const Cluster  = require('../src/models/Cluster');

let mongoServer;
let adminToken;
let operatorToken;
let viewerToken;

jest.setTimeout(600000);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

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

  const hash = async (pw) => bcrypt.hash(pw, 4);
  await User.create({ email: 'admin@test.com',    password: await hash('AdminPass1!'),    role: 'admin' });
  await User.create({ email: 'operator@test.com', password: await hash('OperatorPass1!'), role: 'operator' });
  await User.create({ email: 'viewer@test.com',   password: await hash('ViewerPass1!'),   role: 'viewer' });

  const login = async (email, password) => {
    const r = await request(app).post('/api/auth/login').send({ email, password });
    return r.body.data.token;
  };

  adminToken    = await login('admin@test.com',    'AdminPass1!');
  operatorToken = await login('operator@test.com', 'OperatorPass1!');
  viewerToken   = await login('viewer@test.com',   'ViewerPass1!');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeAlert(overrides = {}) {
  const cluster = await Cluster.create({
    testType:         'TDS',
    centroid:         { type: 'Point', coordinates: [76.9366, 8.5241] },
    radiusMetres:     500,
    observationCount: 5,
    failureRate:      1,
    windowStart:      new Date(),
    windowEnd:        new Date(),
    wardId:           'ward-01',
    detectedAt:       new Date(),
    active:           true,
  });

  return Alert.create({
    clusterId: cluster._id,
    severity:  'high',
    message:   'Test alert',
    wardId:    'ward-01',
    resolved:  false,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/alerts/:id/resolve  — authentication & authorization
// ---------------------------------------------------------------------------
describe('PATCH /api/alerts/:id/resolve — auth', () => {
  it('returns 401 when no token is provided', async () => {
    const alert = await makeAlert();
    const res = await request(app).patch(`/api/alerts/${alert._id}/resolve`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for viewer role', async () => {
    const alert = await makeAlert();
    const res = await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/alerts/:id/resolve  — operator
// ---------------------------------------------------------------------------
describe('PATCH /api/alerts/:id/resolve — operator', () => {
  it('operator can resolve an active alert', async () => {
    const alert = await makeAlert();
    const res = await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert.resolved).toBe(true);
    expect(res.body.data.alert.resolvedAt).not.toBeNull();
    expect(res.body.data.alert.id).toBe(alert._id.toString());
  });

  it('operator resolve does not expose _id', async () => {
    const alert = await makeAlert();
    const res = await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.body.data.alert).not.toHaveProperty('_id');
    expect(res.body.data.alert).toHaveProperty('id');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/alerts/:id/resolve  — admin
// ---------------------------------------------------------------------------
describe('PATCH /api/alerts/:id/resolve — admin', () => {
  it('admin can resolve an active alert', async () => {
    const alert = await makeAlert();
    const res = await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.alert.resolved).toBe(true);
    expect(res.body.data.alert.resolvedAt).not.toBeNull();
  });

  it('resolving an already-resolved alert is idempotent — returns 200', async () => {
    const resolvedAt = new Date('2026-01-01T00:00:00.000Z');
    const alert = await makeAlert({ resolved: true, resolvedAt });

    const res = await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert.resolved).toBe(true);
    // resolvedAt must not change — the original timestamp is preserved
    expect(new Date(res.body.data.alert.resolvedAt).toISOString()).toBe(resolvedAt.toISOString());
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/alerts/:id/resolve  — validation & errors
// ---------------------------------------------------------------------------
describe('PATCH /api/alerts/:id/resolve — validation', () => {
  it('returns 400 for a malformed ObjectId', async () => {
    const res = await request(app)
      .patch('/api/alerts/not-a-valid-id/resolve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a valid ObjectId that does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/alerts/${fakeId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/alerts  — interaction with resolved state
// ---------------------------------------------------------------------------
describe('GET /api/alerts — interaction with resolution', () => {
  it('active=true excludes resolved alerts', async () => {
    await makeAlert({ resolved: false });
    const resolved = await makeAlert({ resolved: true, resolvedAt: new Date() });

    // resolve via endpoint to ensure full state
    await request(app)
      .patch(`/api/alerts/${resolved._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/alerts?active=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.alerts.map((a) => a.id);
    expect(ids).not.toContain(resolved._id.toString());
    expect(res.body.data.alerts.every((a) => a.resolved === false)).toBe(true);
  });

  it('after resolving via PATCH, alert disappears from active=true list', async () => {
    const alert = await makeAlert();

    // Initially appears in active list
    const before = await request(app)
      .get('/api/alerts?active=true')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(before.body.data.alerts.map((a) => a.id)).toContain(alert._id.toString());

    // Resolve it
    await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${operatorToken}`);

    // No longer in active list
    const after = await request(app)
      .get('/api/alerts?active=true')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(after.body.data.alerts.map((a) => a.id)).not.toContain(alert._id.toString());
  });

  it('resolved alert appears when active=false', async () => {
    const alert = await makeAlert();
    await request(app)
      .patch(`/api/alerts/${alert._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/alerts?active=false')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.alerts.map((a) => a.id);
    expect(ids).toContain(alert._id.toString());
  });

  it('GET /api/alerts returns resolvedAt field on all alerts', async () => {
    await makeAlert();
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const a = res.body.data.alerts[0];
    expect(a).toHaveProperty('resolvedAt');
    expect(a).not.toHaveProperty('_id');
  });

  it('ward filtering still works alongside resolution', async () => {
    await makeAlert({ wardId: 'ward-01' });
    await makeAlert({ wardId: 'ward-02' });

    const res = await request(app)
      .get('/api/alerts?wardId=ward-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.alerts.every((a) => a.wardId === 'ward-01')).toBe(true);
  });
});
