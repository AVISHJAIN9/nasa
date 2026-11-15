import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Node Backend App & Health Endpoint', () => {
  let app;

  beforeAll(async () => {
    app = await createApp();
  });

  it('should initialize Express app and mount routes', () => {
    expect(app).toBeDefined();
  });

  it('GET /health returns health status', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version', '0.1.0');
    expect(res.body).toHaveProperty('components');
  });

  it('GET /metrics returns prometheus formatted metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('astrocare_uptime_seconds');
  });
});
