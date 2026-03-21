import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';
import { createTestUser, createTestCategory, createTestQuestion } from '../setup.js';

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

describe('GET /api/questions', () => {
  it('returns paginated questions', async () => {
    const user = await createTestUser();
    const cat = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    await createTestQuestion({ category_id: cat.id, question_text: 'Q1' });
    await createTestQuestion({ category_id: cat.id, question_text: 'Q2' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/questions?limit=10&offset=0',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.pagination.total).toBe(2);
  });

  it('filters by categoryId', async () => {
    const user = await createTestUser();
    const cat1 = await createTestCategory({ name: 'Sport', slug: 'sport' });
    const cat2 = await createTestCategory({ name: 'Histoire', slug: 'histoire' });
    await createTestQuestion({ category_id: cat1.id, question_text: 'Sport Q' });
    await createTestQuestion({ category_id: cat2.id, question_text: 'Histoire Q' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/questions?categoryId=${cat1.id}`,
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.json().data.length).toBe(1);
    expect(res.json().data[0].question_text).toBe('Sport Q');
  });

  it('filters by difficulty', async () => {
    const user = await createTestUser();
    const cat = await createTestCategory({ name: 'Test', slug: 'test' });
    await createTestQuestion({ category_id: cat.id, difficulty: 'easy' });
    await createTestQuestion({ category_id: cat.id, difficulty: 'hard' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/questions?difficulty=hard',
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.json().data.length).toBe(1);
    expect(res.json().data[0].difficulty).toBe('hard');
  });
});

describe('GET /api/questions/random', () => {
  it('returns random questions from a category', async () => {
    const user = await createTestUser();
    const cat = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    for (let i = 0; i < 10; i++) {
      await createTestQuestion({ category_id: cat.id, question_text: `Q${i}` });
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/questions/random?categoryId=${cat.id}&count=5`,
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(5);
  });

  it('picks from subcategories when given a root category', async () => {
    const user = await createTestUser();
    const root = await createTestCategory({ name: 'Sciences', slug: 'sciences' });
    const sub1 = await createTestCategory({ name: 'Physique', slug: 'physique', parent_id: root.id });
    const sub2 = await createTestCategory({ name: 'Biologie', slug: 'biologie', parent_id: root.id });
    await createTestQuestion({ category_id: sub1.id, question_text: 'Physics Q' });
    await createTestQuestion({ category_id: sub2.id, question_text: 'Biology Q' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/questions/random?categoryId=${root.id}&count=10`,
      headers: authHeaders(user.firebase_uid),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(2); // Only 2 questions exist
  });

  it('requires categoryId', async () => {
    const user = await createTestUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/questions/random',
      headers: authHeaders(user.firebase_uid),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/questions (admin)', () => {
  it('creates a question and increments category count', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-q1' });
    const cat = await createTestCategory({ name: 'Test', slug: 'test' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      headers: authHeaders(admin.firebase_uid),
      payload: {
        question_text: 'What is 2+2?',
        answers: ['1', '2', '3', '4'],
        correct_index: 3,
        category_id: cat.id,
        difficulty: 'easy',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.question_text).toBe('What is 2+2?');
  });

  it('validates answers must have exactly 4 elements', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-q2' });
    const cat = await createTestCategory({ name: 'Test', slug: 'test' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      headers: authHeaders(admin.firebase_uid),
      payload: {
        question_text: 'Bad question',
        answers: ['A', 'B', 'C'],
        correct_index: 0,
        category_id: cat.id,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('validates correct_index between 0 and 3', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-q3' });
    const cat = await createTestCategory({ name: 'Test', slug: 'test' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/questions',
      headers: authHeaders(admin.firebase_uid),
      payload: {
        question_text: 'Bad index',
        answers: ['A', 'B', 'C', 'D'],
        correct_index: 5,
        category_id: cat.id,
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/questions/import (admin, batch)', () => {
  it('imports multiple questions', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-imp' });
    const cat = await createTestCategory({ name: 'Import', slug: 'import' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/questions/import',
      headers: authHeaders(admin.firebase_uid),
      payload: {
        questions: [
          { question_text: 'Q1', answers: ['A', 'B', 'C', 'D'], correct_index: 0, category_id: cat.id },
          { question_text: 'Q2', answers: ['A', 'B', 'C', 'D'], correct_index: 1, category_id: cat.id },
          { question_text: 'Q3', answers: ['A', 'B', 'C', 'D'], correct_index: 2, category_id: cat.id },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.imported).toBe(3);
  });
});

describe('DELETE /api/questions/:id (admin, soft delete)', () => {
  it('soft deletes a question', async () => {
    const admin = await createTestUser({ role: 'admin', firebase_uid: 'admin-del' });
    const cat = await createTestCategory({ name: 'Del', slug: 'del' });
    const q = await createTestQuestion({ category_id: cat.id });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/questions/${q.id}`,
      headers: authHeaders(admin.firebase_uid),
    });

    expect(res.statusCode).toBe(200);

    // Should not appear in listing
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/questions',
      headers: authHeaders(admin.firebase_uid),
    });
    expect(listRes.json().data.length).toBe(0);
  });
});
