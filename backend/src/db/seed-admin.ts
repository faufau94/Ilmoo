/**
 * Seed the initial admin account.
 * Run with: npx tsx src/db/seed-admin.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });
import bcrypt from 'bcrypt';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

async function seedAdmin() {
  const email = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!email || !password) {
    console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Upsert: create or update the admin account
  const result = await pool.query(
    `INSERT INTO users (firebase_uid, email, username, role, is_anonymous, password_hash)
     VALUES ($1, $2, $3, 'admin', false, $4)
     ON CONFLICT (firebase_uid) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       role = 'admin'
     RETURNING id, email, role`,
    [`admin-${email}`, email, 'Admin', passwordHash],
  );

  console.log('Admin account ready:', result.rows[0]);
  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});
