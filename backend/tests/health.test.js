const request = require('supertest');
const app = require('../src/app');

describe('Phase 1 — Express application and health endpoint', () => {
  it('Express application initializes', () => {
    expect(app).toBeDefined();
  });

  it('GET /health returns HTTP 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /health returns expected success structure', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });
});
