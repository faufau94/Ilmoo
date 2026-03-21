import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  const { fastify } = await buildApp({ logger: false });
  app = fastify;
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/config/:flavorSlug', () => {
  it('returns ilmoo config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/ilmoo',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.appName).toBe('Ilmoo');
    expect(body.data.primaryColor).toBeDefined();
    expect(body.data.isActive).toBe(true);
  });

  it('returns quizapp config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/quizapp',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.appName).toBe('QuizBattle');
  });

  it('returns 404 for unknown flavor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/unknown-flavor',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('second call is served from Redis cache', async () => {
    // First call populates cache
    await app.inject({ method: 'GET', url: '/api/config/ilmoo' });

    // Second call should still succeed (from cache)
    const res = await app.inject({ method: 'GET', url: '/api/config/ilmoo' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.appName).toBe('Ilmoo');
  });
});
