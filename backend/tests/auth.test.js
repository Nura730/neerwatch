/**
 * Authentication and RBAC integration tests.
 *
 * Covers:
 *   - POST /api/auth/login
 *   - GET  /api/auth/me
 *   - POST /api/auth/register  (admin only)
 *   - Role-based access to existing API endpoints
 *   - Token validation (missing, invalid, expired)
 *   - Password hash never exposed in responses
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/User');

let mongoServer;

jest.setTimeout(600000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(email, password, role) {
  const hash = await bcrypt.hash(password, 4);
  return User.create({ email, password: hash, role });
}

async function loginAs(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data?.token;
}

const validObs = (overrides = {}) => ({
  clientId:    'obs-001',
  householdId: 'HH-001',
  testType:    'TDS',
  result:      320,
  testedAt:    '2024-03-15T09:00:00.000Z',
  location:    { lat: 8.5241, lng: 76.9366 },
  wardId:      'ward-01',
  ...overrides,
});

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
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await createUser('user@test.com', 'Password1!', 'viewer');
  });

  it('returns token and user on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe('user@test.com');
    expect(res.body.data.user.role).toBe('viewer');
    expect(res.body.data.user).toHaveProperty('id');
  });

  it('does not return password hash in login response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password1!' });

    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // bcrypt hash pattern
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password1!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com' }); // no password

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me', () => {
  it('returns current user profile for valid token', async () => {
    await createUser('me@test.com', 'Password1!', 'operator');
    const token = await loginAs('me@test.com', 'Password1!');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('me@test.com');
    expect(res.body.data.user.role).toBe('operator');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not.valid');

    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    // Manually create a token with an exp claim in the past
    const expiredToken = jwt.sign(
      { sub: new mongoose.Types.ObjectId().toString(), email: 'x@test.com', role: 'viewer',
        exp: Math.floor(Date.now() / 1000) - 60 },
      'neerwatch-test-secret'
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer prefix is missing', async () => {
    await createUser('hdr@test.com', 'Password1!', 'viewer');
    const token = await loginAs('hdr@test.com', 'Password1!');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', token); // missing "Bearer "

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/register  (admin only)
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  let adminToken;
  let operatorToken;
  let viewerToken;

  beforeEach(async () => {
    await createUser('admin@test.com',    'AdminPass1!', 'admin');
    await createUser('operator@test.com', 'OperPass1!',  'operator');
    await createUser('viewer@test.com',   'ViewPass1!',  'viewer');
    adminToken    = await loginAs('admin@test.com',    'AdminPass1!');
    operatorToken = await loginAs('operator@test.com', 'OperPass1!');
    viewerToken   = await loginAs('viewer@test.com',   'ViewPass1!');
  });

  it('admin can create a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'new@test.com', password: 'NewPass123!', role: 'operator' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('new@test.com');
    expect(res.body.data.user.role).toBe('operator');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('admin creates viewer by default when role is omitted', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'default@test.com', password: 'DefaultPass1!' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('viewer');
  });

  it('admin can create another admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'admin2@test.com', password: 'Admin2Pass1!', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('operator cannot register a new user — 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ email: 'blocked@test.com', password: 'BlockedPass1!' });

    expect(res.status).toBe(403);
  });

  it('viewer cannot register a new user — 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'blocked@test.com', password: 'BlockedPass1!' });

    expect(res.status).toBe(403);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'anon@test.com', password: 'AnonPass1!' });

    expect(res.status).toBe(401);
  });

  it('returns 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'admin@test.com', password: 'NewPass123!' }); // already exists

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-an-email', password: 'ValidPass1!' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'short@test.com', password: 'abc' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'role@test.com', password: 'ValidPass1!', role: 'superadmin' });

    expect(res.status).toBe(400);
  });

  it('never exposes password hash in registration response', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'nohash@test.com', password: 'ValidPass1!' });

    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    expect(res.body.data.user).not.toHaveProperty('password');
  });
});

// ---------------------------------------------------------------------------
// Role-based access — existing endpoints
// ---------------------------------------------------------------------------
describe('Role-based access control', () => {
  let adminToken;
  let operatorToken;
  let viewerToken;

  beforeEach(async () => {
    await createUser('admin@test.com',    'AdminPass1!', 'admin');
    await createUser('operator@test.com', 'OperPass1!',  'operator');
    await createUser('viewer@test.com',   'ViewPass1!',  'viewer');
    adminToken    = await loginAs('admin@test.com',    'AdminPass1!');
    operatorToken = await loginAs('operator@test.com', 'OperPass1!');
    viewerToken   = await loginAs('viewer@test.com',   'ViewPass1!');
  });

  // ── Read-only access (all authenticated roles) ───────────────────────────

  it('viewer can read dashboard', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer can read observations list', async () => {
    const res = await request(app)
      .get('/api/tests')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer can read map observations', async () => {
    const res = await request(app)
      .get('/api/tests/map')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer can read clusters', async () => {
    const res = await request(app)
      .get('/api/clusters')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer can read alerts', async () => {
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer can read wards', async () => {
    const res = await request(app)
      .get('/api/wards')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('viewer can read rainfall', async () => {
    const res = await request(app)
      .get('/api/rainfall')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  // ── Mutation blocked for viewer ──────────────────────────────────────────

  it('viewer cannot create an observation — 403', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(validObs());
    expect(res.status).toBe(403);
  });

  it('viewer cannot sync observations — 403', async () => {
    const res = await request(app)
      .post('/api/tests/sync')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ observations: [validObs()] });
    expect(res.status).toBe(403);
  });

  // ── Operator access ───────────────────────────────────────────────────────

  it('operator can create an observation', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(validObs());
    expect(res.status).toBe(201);
  });

  it('operator can sync observations', async () => {
    const res = await request(app)
      .post('/api/tests/sync')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ observations: [validObs()] });
    expect(res.status).toBe(200);
  });

  it('operator cannot register users — 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ email: 'new@test.com', password: 'NewPass123!' });
    expect(res.status).toBe(403);
  });

  // ── Admin full access ─────────────────────────────────────────────────────

  it('admin can create an observation', async () => {
    const res = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validObs());
    expect(res.status).toBe(201);
  });

  it('admin can sync observations', async () => {
    const res = await request(app)
      .post('/api/tests/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ observations: [validObs()] });
    expect(res.status).toBe(200);
  });

  it('admin can register users', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newuser@test.com', password: 'NewUser1!', role: 'viewer' });
    expect(res.status).toBe(201);
  });

  // ── Unauthenticated access blocked ────────────────────────────────────────

  it('unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
