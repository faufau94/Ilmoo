/**
 * Seed the initial admin account.
 * Run standalone: npx tsx src/db/seed-admin.ts
 */
import bcrypt from 'bcrypt';
import { db } from './index.js';
import { sql } from 'drizzle-orm';

export async function seedAdmin() {
  const email = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!email || !password) {
    console.warn('Missing ADMIN_EMAIL or ADMIN_PASSWORD — skipping admin seed');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Upsert: create or update the admin account
  const result = await db.execute(sql`
    INSERT INTO users (firebase_uid, email, username, role, is_anonymous, password_hash)
    VALUES (${`admin-${email}`}, ${email}, ${'Admin'}, 'admin', false, ${passwordHash})
    ON CONFLICT (firebase_uid) DO UPDATE SET
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      role = 'admin'
    RETURNING id, email, role
  `);

  console.log('Admin account ready:', result.rows[0]);
}

// Standalone execution
if (process.argv[1]?.includes('seed-admin')) {
  const { config: dotenvConfig } = await import('dotenv');
  const { resolve } = await import('node:path');
  dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });
  const pool = (await import('./connection.js')).default;
  seedAdmin()
    .then(() => pool.end())
    .catch((err) => { console.error('Failed to seed admin:', err); process.exit(1); });
}
