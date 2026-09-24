/**
 * Field-task API integration tests.
 */

process.env.JWT_SECRET    = 'neerwatch-test-secret';
process.env.BCRYPT_ROUNDS = '4';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/User');

jest.setTimeout(600000);

let mongoServer;
let adminToken;
let operatorToken;
let viewerToken;

async function createUser(email, password, role) {
  const hash = await bcrypt.hash(password, 4);
  return User.create({ email, password: hash, role });
}
async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data?.token;
}

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
  await createUser('admin@test.com',    'AdminPass1!', 'admin');
  await createUser('operator@test.com', 'OperPass1!',  'operator');
  await createUser('viewer@test.com',   'ViewPass1!',  'viewer');
  adminToken    = await loginAs('admin@test.com',    'AdminPass1!');
  operatorToken = await loginAs('operator@test.com', 'OperPass1!');
  viewerToken   = await loginAs('viewer@test.com',   'ViewPass1!');
});

const validTask = (overrides = {}) => ({
  title:       'Verify TDS at Household 12',
  description: 'High TDS detected — field verification required',
  wardId:      'ward-01',
  priority:    'high',
  location:    { lat: 8.5241, lng: 76.9366 },
  ...overrides,
});

// ── Creation ──────────────────────────────────────────────────────────────────

describe('POST /api/field-tasks', () => {
  it('operator creates a task — 201 with correct shape', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(validTask());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const t = res.body.data.task;
    expect(t).toHaveProperty('id');
    expect(t).not.toHaveProperty('_id');
    expect(t.title).toBe('Verify TDS at Household 12');
    expect(t.wardId).toBe('ward-01');
    expect(t.priority).toBe('high');
    expect(t.status).toBe('pending');
    expect(t.location).toEqual({ lat: 8.5241, lng: 76.9366 });
    expect(t).toHaveProperty('createdAt');
    expect(t).toHaveProperty('updatedAt');
  });

  it('admin creates a task with minimal fields', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Quick check', wardId: 'ward-02' });

    expect(res.status).toBe(201);
    expect(res.body.data.task.priority).toBe('medium'); // default
    expect(res.body.data.task.status).toBe('pending');
    expect(res.body.data.task.location).toBeNull();
  });

  it('creates task with assignedTo — status becomes assigned', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(validTask({ assignedTo: 'user-123' }));

    expect(res.status).toBe(201);
    expect(res.body.data.task.status).toBe('assigned');
    expect(res.body.data.task.assignedTo).toBe('user-123');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ wardId: 'ward-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/);
  });

  it('returns 400 when wardId is missing', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: 'Test task' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/wardId/);
  });

  it('returns 400 for invalid priority', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(validTask({ priority: 'urgent' }));
    expect(res.status).toBe(400);
  });

  it('viewer cannot create a task — 403', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(validTask());
    expect(res.status).toBe(403);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app)
      .post('/api/field-tasks')
      .send(validTask());
    expect(res.status).toBe(401);
  });
});

// ── Read / filters ────────────────────────────────────────────────────────────

describe('GET /api/field-tasks', () => {
  beforeEach(async () => {
    await request(app).post('/api/field-tasks').set('Authorization', `Bearer ${operatorToken}`)
      .send(validTask({ wardId: 'ward-01', priority: 'high' }));
    await request(app).post('/api/field-tasks').set('Authorization', `Bearer ${operatorToken}`)
      .send(validTask({ title: 'Task 2', wardId: 'ward-02', priority: 'low' }));
  });

  it('returns all tasks without auth (public)', async () => {
    const res = await request(app).get('/api/field-tasks');
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(2);
  });

  it('filters by wardId', async () => {
    const res = await request(app).get('/api/field-tasks?wardId=ward-01');
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].wardId).toBe('ward-01');
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/field-tasks?status=pending');
    expect(res.body.data.tasks).toHaveLength(2);
  });

  it('filters by priority', async () => {
    const res = await request(app).get('/api/field-tasks?priority=low');
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].priority).toBe('low');
  });

  it('filters by assignedTo', async () => {
    await request(app).post('/api/field-tasks').set('Authorization', `Bearer ${operatorToken}`)
      .send(validTask({ title: 'Assigned', wardId: 'ward-01', assignedTo: 'user-42' }));
    const res = await request(app).get('/api/field-tasks?assignedTo=user-42');
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].assignedTo).toBe('user-42');
  });
});

describe('GET /api/field-tasks/:id', () => {
  it('returns a single task', async () => {
    const created = await request(app).post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`).send(validTask());
    const id = created.body.data.task.id;

    const res = await request(app).get(`/api/field-tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.task.id).toBe(id);
  });

  it('returns 400 for invalid id format', async () => {
    const res = await request(app).get('/api/field-tasks/not-an-id');
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent task', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/field-tasks/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

// ── General update ────────────────────────────────────────────────────────────

describe('PATCH /api/field-tasks/:id', () => {
  let taskId;
  beforeEach(async () => {
    const res = await request(app).post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`).send(validTask());
    taskId = res.body.data.task.id;
  });

  it('operator updates title and priority', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: 'Updated title', priority: 'critical' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe('Updated title');
    expect(res.body.data.task.priority).toBe('critical');
  });

  it('returns 400 for invalid priority in update', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ priority: 'bad' });
    expect(res.status).toBe(400);
  });

  it('viewer cannot update — 403', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent task', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/field-tasks/${fakeId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});

// ── Assignment ────────────────────────────────────────────────────────────────

describe('PATCH /api/field-tasks/:id/assign', () => {
  let taskId;
  beforeEach(async () => {
    const res = await request(app).post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`).send(validTask());
    taskId = res.body.data.task.id;
  });

  it('assigns a task and transitions pending → assigned', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ assignedTo: 'user-007' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.assignedTo).toBe('user-007');
    expect(res.body.data.task.status).toBe('assigned');
  });

  it('unassigning clears assignedTo and reverts to pending', async () => {
    await request(app).patch(`/api/field-tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ assignedTo: 'user-007' });

    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ assignedTo: null });
    expect(res.status).toBe(200);
    expect(res.body.data.task.assignedTo).toBeNull();
    expect(res.body.data.task.status).toBe('pending');
  });

  it('cannot assign a completed task', async () => {
    // transition to completed
    await request(app).patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ status: 'in_progress' });
    await request(app).patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ status: 'completed' });

    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ assignedTo: 'user-007' });
    expect(res.status).toBe(400);
  });

  it('viewer cannot assign — 403', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ assignedTo: 'user-007' });
    expect(res.status).toBe(403);
  });
});

// ── Status transitions ─────────────────────────────────────────────────────────

describe('PATCH /api/field-tasks/:id/status', () => {
  let taskId;
  beforeEach(async () => {
    const res = await request(app).post('/api/field-tasks')
      .set('Authorization', `Bearer ${operatorToken}`).send(validTask());
    taskId = res.body.data.task.id;
  });

  it('pending → in_progress is allowed', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('in_progress');
  });

  it('pending → cancelled is allowed', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('cancelled');
  });

  it('in_progress → completed sets completedAt', async () => {
    await request(app).patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ status: 'in_progress' });
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('completed');
    expect(res.body.data.task.completedAt).not.toBeNull();
  });

  it('invalid transition pending → completed is rejected', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cannot transition/);
  });

  it('terminal status completed → anything is rejected', async () => {
    await request(app).patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ status: 'in_progress' });
    await request(app).patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ status: 'completed' });

    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
  });

  it('terminal status cancelled → anything is rejected', async () => {
    await request(app).patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ status: 'cancelled' });
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown status value', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'done' });
    expect(res.status).toBe(400);
  });

  it('viewer cannot change status — 403', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated status change returns 401', async () => {
    const res = await request(app)
      .patch(`/api/field-tasks/${taskId}/status`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(401);
  });
});
