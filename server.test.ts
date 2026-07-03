// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './server';

describe('proxy server', () => {
  it('GET /api/health returns ok with queue and cap metrics', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('queueSize');
    expect(res.body).toHaveProperty('queuePending');
    expect(res.body).toHaveProperty('dailyUsed');
    expect(res.body).toHaveProperty('dailyCap');
  });

  it('GET /api/status reports proxy availability', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('proxyAvailable');
    expect(typeof res.body.proxyAvailable).toBe('boolean');
  });

  it('POST /api/restore rejects invalid requests cleanly, then rate-limits at 11th request', async () => {
    // First 10 requests pass the limiter and fail fast before any Gemini call:
    // 400 (missing fields) when a server key exists, 500 (no key) otherwise
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/restore').send({});
      expect([400, 500]).toContain(res.status);
      expect(res.body.error).toBeTruthy();
    }
    // 11th request within the window must hit the rate limiter
    const limited = await request(app).post('/api/restore').send({});
    expect(limited.status).toBe(429);
  });
});
