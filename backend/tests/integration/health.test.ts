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

describe('GET /health', () => {
  it('returns status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
