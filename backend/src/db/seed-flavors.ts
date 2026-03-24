/**
 * Seed app flavors (Ilmoo + QuizBattle).
 * Run standalone: npx tsx src/db/seed-flavors.ts
 */
import { db } from './index.js';
import { sql } from 'drizzle-orm';

export async function seedFlavors() {
  console.log('Seeding app flavors...');

  await db.execute(sql`
    INSERT INTO app_flavors (slug, app_name, app_description, support_email, primary_color, primary_dark, accent_positive, accent_negative)
    VALUES
      ('ilmoo', 'Ilmoo', 'Quiz culture générale multijoueur', 'support@ilmoo.com', '#1B4332', '#081C15', '#52B788', '#F4845F'),
      ('quizapp', 'QuizBattle', 'Quiz culture générale multijoueur', 'support@quizbattle.com', '#1A365D', '#0A1628', '#4299E1', '#FC8181')
    ON CONFLICT (slug) DO NOTHING
  `);

  console.log('✓ App flavors ready (ilmoo + quizapp)');
}

// Standalone execution
if (process.argv[1]?.includes('seed-flavors')) {
  const { config: dotenvConfig } = await import('dotenv');
  const { resolve } = await import('node:path');
  dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });
  const pool = (await import('./connection.js')).default;
  seedFlavors()
    .then(() => pool.end())
    .catch((err) => { console.error('Failed to seed flavors:', err); process.exit(1); });
}
