/**
 * Master seed runner — executes all seed scripts in order.
 *
 * Can be imported: import { runSeeds } from './db/seed.js'
 * Or run standalone: npx tsx src/db/seed.ts
 */
import { seedFlavors } from './seed-flavors.js';
import { seedAdmin } from './seed-admin.js';
import { seedCategories } from './seed-categories.js';
import { seedQuestions1 } from './seed-questions-1.js';
import { seedQuestions2 } from './seed-questions-2.js';
import { seedQuestions3 } from './seed-questions-3.js';
import { db } from './index.js';
import { sql } from 'drizzle-orm';

export async function runSeeds() {
  // Always run these (truly idempotent with ON CONFLICT / upsert)
  console.log('── flavors ──');
  await seedFlavors();
  console.log('');
  console.log('── admin ──');
  await seedAdmin();
  console.log('');

  // Check if bulk data seeds already ran
  const result = await db.execute(sql`SELECT COUNT(*)::int as count FROM questions`);
  const questionCount = (result.rows[0] as { count: number }).count;

  if (questionCount > 0) {
    console.log(`✓ ${questionCount} questions already in DB — skipping data seeds.\n`);
    return;
  }

  // First run: seed categories + questions
  const dataSeeds: { name: string; fn: () => Promise<void> }[] = [
    { name: 'categories', fn: seedCategories },
    { name: 'questions-1', fn: seedQuestions1 },
    { name: 'questions-2', fn: seedQuestions2 },
    { name: 'questions-3', fn: seedQuestions3 },
  ];

  for (const { name, fn } of dataSeeds) {
    console.log(`── ${name} ──`);
    await fn();
    console.log('');
  }

  console.log('All seeds done.');
}

// Standalone execution
if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  const { config: dotenvConfig } = await import('dotenv');
  const { resolve } = await import('node:path');
  dotenvConfig({ path: resolve(import.meta.dirname, '../../../.env') });
  const pool = (await import('./connection.js')).default;
  runSeeds()
    .then(() => pool.end())
    .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
}
