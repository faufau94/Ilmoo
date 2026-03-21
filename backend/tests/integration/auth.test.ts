import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';
import { createTestUser } from '../setup.js';

let app: FastifyInstance;

beforeAll(async () => {
  const { fastify } = await buildApp({ logger: false });
  app = fastify;
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function authHeaders(firebaseUid: string) {
  return { authorization: `Bearer test-token-${firebaseUid}` };
}

describe('Auth middleware', () => {
  it('creates an anonymous user on first request with a valid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: authHeaders('new-user-abc'),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.firebase_uid).toBe('new-user-abc');
    expect(body.data.is_anonymous).toBe(true);
  });

  it('returns existing user on subsequent requests', async () => {
    const user = await createTestUser({ firebase_uid: 'existing-user', username: 'TestPlayer' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.username).toBe('TestPlayer');
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { authorization: 'Bearer test-token-invalid' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('blocks banned users', async () => {
    await createTestUser({ firebase_uid: 'banned-user', status: 'banned' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: authHeaders('banned-user'),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/auth/link', () => {
  it('links an anonymous account', async () => {
    const user = await createTestUser({
      firebase_uid: 'anon-link',
      is_anonymous: true,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/link',
      headers: authHeaders(user.firebase_uid),
      payload: { username: 'LinkedPlayer', email: 'linked@test.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.is_anonymous).toBe(false);
    expect(res.json().data.username).toBe('LinkedPlayer');
    expect(res.json().data.email).toBe('linked@test.com');
  });
});

describe('requireLinked middleware', () => {
  it('blocks anonymous users on protected routes', async () => {
    const user = await createTestUser({
      firebase_uid: 'anon-blocked',
      is_anonymous: true,
    });

    // PUT /api/users/me requires linked account for username change
    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me',
      headers: authHeaders(user.firebase_uid),
      payload: { username: 'NewName' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('account_link_required');
  });

  it('allows linked users on protected routes', async () => {
    const user = await createTestUser({
      firebase_uid: 'linked-ok',
      is_anonymous: false,
      username: 'OldName',
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me',
      headers: authHeaders(user.firebase_uid),
      payload: { username: 'NewName' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.username).toBe('NewName');
  });
});
