/**
 * Seed app flavors (Ilmoo + QuizBattle).
 * Run with: npx tsx src/db/seed-flavors.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });
import { db, appFlavors } from './index.js';
import { sql } from 'drizzle-orm';
import pool from './connection.js';

async function seedFlavors() {
  console.log('Seeding app flavors...');

  await db.execute(sql`
    INSERT INTO app_flavors (slug, app_name, app_description, support_email, primary_color, primary_dark, accent_positive, accent_negative)
    VALUES
      ('ilmoo', 'Ilmoo', 'Quiz culture générale multijoueur', 'support@ilmoo.com', '#1B4332', '#081C15', '#52B788', '#F4845F'),
      ('quizapp', 'QuizBattle', 'Quiz culture générale multijoueur', 'support@quizbattle.com', '#1A365D', '#0A1628', '#4299E1', '#FC8181')
    ON CONFLICT (slug) DO NOTHING
  `);

  console.log('✓ App flavors ready (ilmoo + quizapp)');
  await pool.end();
}

seedFlavors().catch((err) => {
  console.error('Failed to seed flavors:', err);
  process.exit(1);
});
