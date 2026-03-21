import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

// Load .env from project root (one level up from backend/)
dotenvConfig({ path: resolve(import.meta.dirname, '../../.env') });

import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';

// ── Mock Firebase before anything imports it ──
vi.mock('../src/services/firebase.js', () => ({
  verifyToken: vi.fn(async (token: string) => {
    // Token format for tests: "test-token-{firebaseUid}"
    const uid = token.replace('test-token-', '');
    if (!uid || uid === 'invalid') {
      throw new Error('Invalid token');
    }
    return { uid };
  }),
  sendPushNotification: vi.fn(async () => 'mock-message-id'),
}));

// ── Test database ──
// Use a separate test database (same URL with _test suffix)
const baseUrl = process.env['DATABASE_URL'] || 'postgresql://ilmoo:motdepasse@localhost:5432/ilmoo';
const testDbUrl = baseUrl.replace(/\/([^/]+)$/, '/$1_test');

// Pool for creating/dropping the test database
const adminPool = new Pool({ connectionString: baseUrl });

// Pool for the test database itself
let testPool: Pool;

// Override DATABASE_URL so the app uses the test database
process.env['DATABASE_URL'] = testDbUrl;

// Read the schema SQL
const schemaPath = resolve(import.meta.dirname, '../src/db/schema.sql');
const schemaSql = readFileSync(schemaPath, 'utf-8');

beforeAll(async () => {
  // Create test database if it doesn't exist
  try {
    await adminPool.query('CREATE DATABASE ilmoo_test');
  } catch (err) {
    // Database already exists — that's fine
    if ((err as { code?: string }).code !== '42P04') {
      throw err;
    }
  }

  testPool = new Pool({ connectionString: testDbUrl });

  // Drop all existing tables/types and recreate schema
  await testPool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  await testPool.query(schemaSql);
});

afterEach(async () => {
  if (!testPool) return;

  // Truncate all tables (preserves schema, fast reset between tests)
  const tables = await testPool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('app_flavors')
  `);

  if (tables.rows.length > 0) {
    const tableNames = tables.rows.map((r) => `"${r.tablename as string}"`).join(', ');
    await testPool.query(`TRUNCATE ${tableNames} CASCADE`);
  }
});

afterAll(async () => {
  if (testPool) await testPool.end();
  await adminPool.end();

  // Also close the app's connection pool (imported by modules)
  try {
    const { default: appPool } = await import('../src/db/connection.js');
    await appPool.end();
  } catch {
    // ignore
  }
});

// ── Test helpers ──

export async function getTestPool(): Promise<Pool> {
  return testPool;
}

export async function createTestUser(overrides: Record<string, unknown> = {}) {
  const defaults = {
    firebase_uid: `test-uid-${Math.random().toString(36).slice(2)}`,
    is_anonymous: true,
    role: 'player',
    status: 'active',
    app_flavor: 'ilmoo',
  };
  const data = { ...defaults, ...overrides };

  const result = await testPool.query(
    `INSERT INTO users (firebase_uid, username, email, role, status, is_anonymous, app_flavor, subscription)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.firebase_uid,
      data.username ?? null,
      data.email ?? null,
      data.role,
      data.status,
      data.is_anonymous,
      data.app_flavor,
      data.subscription ?? 'free',
    ],
  );
  return result.rows[0]!;
}

export async function createTestCategory(overrides: Record<string, unknown> = {}) {
  const slug = `cat-${Math.random().toString(36).slice(2)}`;
  const defaults = {
    name: `Test Category ${slug}`,
    slug,
    icon_name: 'quiz',
    color: '#1B4332',
    sort_order: 0,
    is_active: true,
  };
  const data = { ...defaults, ...overrides };

  const result = await testPool.query(
    `INSERT INTO categories (name, slug, parent_id, description, icon_name, color, sort_order, is_active, is_premium)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.name,
      data.slug,
      data.parent_id ?? null,
      data.description ?? null,
      data.icon_name,
      data.color,
      data.sort_order,
      data.is_active,
      data.is_premium ?? false,
    ],
  );
  return result.rows[0]!;
}

export async function createTestQuestion(overrides: Record<string, unknown> = {}) {
  const defaults = {
    question_text: 'What is 2 + 2?',
    answers: ['3', '4', '5', '6'],
    correct_index: 1,
    difficulty: 'medium',
    is_active: true,
  };
  const data = { ...defaults, ...overrides };

  if (!data.category_id) {
    throw new Error('category_id is required for createTestQuestion');
  }

  const result = await testPool.query(
    `INSERT INTO questions (question_text, answers, correct_index, category_id, difficulty, explanation, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.question_text,
      JSON.stringify(data.answers),
      data.correct_index,
      data.category_id,
      data.difficulty,
      data.explanation ?? null,
      data.is_active,
    ],
  );
  return result.rows[0]!;
}
