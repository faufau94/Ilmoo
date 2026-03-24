/**
 * Master seed runner — executes all seed scripts in order.
 *
 * Run with: npx tsx src/db/seed.ts
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

const dir = resolve(import.meta.dirname);

// Seeds run in this exact order first
const seeds = [
  'seed-flavors.ts',
  'seed-admin.ts',
  'seed-categories.ts',
];

// Auto-discover any future seed-*.ts files not in the list
const allFiles = readdirSync(dir).filter(
  (f) => f.startsWith('seed-') && f.endsWith('.ts') && f !== 'seed.ts',
);
for (const f of allFiles) {
  if (!seeds.includes(f)) {
    seeds.push(f);
  }
}

console.log(`Running ${seeds.length} seed(s)...\n`);

for (const file of seeds) {
  const path = resolve(dir, file);
  console.log(`── ${file} ──`);
  execSync(`npx tsx ${path}`, { stdio: 'inherit' });
  console.log('');
}

console.log('All seeds done.');
