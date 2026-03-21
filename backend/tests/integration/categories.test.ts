import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';
import { createTestUser, createTestCategory } from '../setup.js';

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

describe('GET /api/categories', () => {
  it('returns root categories sorted by sort_order', async () => {
    await createTestCategory({ name: 'Sciences', slug: 'sciences', sort_order: 1 });
    await createTestCategory({ name: 'Sport', slug: 'sport', sort_order: 0 });
    const user = await createTestUser();

    const res = await app.inject({
      method: 'GET',
      url: '/api/categories',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);
    // Sport first (sort_order 0), then Sciences (sort_order 1)
    expect(body.data[0].name).toBe('Sport');
    expect(body.data[1].name).toBe('Sciences');
  });

  it('includes subcategories_count', async () => {
    const root = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    await createTestCategory({ name: 'Physique', slug: 'physique', parent_id: root.id });
    await createTestCategory({ name: 'Biologie', slug: 'biologie', parent_id: root.id });
    const user = await createTestUser();

    const res = await app.inject({
      method: 'GET',
      url: '/api/categories',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    const sciences = res.json().data.find((c: { slug: string }) => c.slug === 'sciences');
    expect(sciences.subcategories_count).toBe(2);
  });

  it('does not return inactive categories', async () => {
    await createTestCategory({ name: 'Active', slug: 'active', is_active: true });
    await createTestCategory({ name: 'Inactive', slug: 'inactive', is_active: false });
    const user = await createTestUser();

    const res = await app.inject({
      method: 'GET',
      url: '/api/categories',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.json().data.length).toBe(1);
    expect(res.json().data[0].name).toBe('Active');
  });
});

describe('GET /api/categories/:slug', () => {
  it('returns category detail with subcategories', async () => {
    const root = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    await createTestCategory({ name: 'Physique', slug: 'physique', parent_id: root.id });
    const user = await createTestUser();

    const res = await app.inject({
      method: 'GET',
      url: '/api/categories/sciences',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.name).toBe('Sciences');
    expect(body.data.subcategories).toHaveLength(1);
    expect(body.data.subcategories[0].name).toBe('Physique');
  });

  it('returns 404 for unknown slug', async () => {
    const user = await createTestUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/categories/nonexistent',
      headers: authHeaders(user.firebase_uid),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/categories (admin)', () => {
  it('creates a root category', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-1' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeaders(admin.firebase_uid),
      payload: { name: 'Histoire', slug: 'histoire', icon_name: 'history', color: '#FF5733' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('Histoire');
    expect(res.json().data.parent_id).toBeNull();
  });

  it('creates a subcategory', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-2' });
    const root = await createTestCategory({ name: 'Sciences', slug: 'sciences' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeaders(admin.firebase_uid),
      payload: { name: 'Chimie', slug: 'chimie', icon_name: 'chemistry', color: '#3498DB', parent_id: root.id },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.parent_id).toBe(root.id);
  });

  it('rejects sub-subcategory (max 2 levels)', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-3' });
    const root = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    const sub = await createTestCategory({ name: 'Physique', slug: 'physique', parent_id: root.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeaders(admin.firebase_uid),
      payload: { name: 'Mécanique', slug: 'mecanique', icon_name: 'gear', color: '#E74C3C', parent_id: sub.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('2 levels');
  });

  it('returns 403 for non-admin user', async () => {
    const user = await createTestUser({ role: 'player', firebase_uid: 'player-1' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeaders(user.firebase_uid),
      payload: { name: 'Test', slug: 'test', icon_name: 'test', color: '#123456' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects duplicate slug', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-4' });
    await createTestCategory({ name: 'Sport', slug: 'sport' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeaders(admin.firebase_uid),
      payload: { name: 'Sport 2', slug: 'sport', icon_name: 'ball', color: '#654321' },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('DELETE /api/categories/:id (admin, CASCADE)', () => {
  it('deletes a root category and its subcategories', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-5' });
    const root = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    await createTestCategory({ name: 'Physique', slug: 'physique', parent_id: root.id });
    await createTestCategory({ name: 'Biologie', slug: 'biologie', parent_id: root.id });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${root.id}`,
      headers: authHeaders(admin.firebase_uid),
    });

    expect(res.statusCode).toBe(200);

    // Verify subcategories are also deleted
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/categories',
      headers: authHeaders(admin.firebase_uid),
    });
    expect(listRes.json().data.length).toBe(0);
  });
});
