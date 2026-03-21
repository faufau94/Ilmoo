import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

pool.on('error', () => {
  process.stderr.write('Unexpected PostgreSQL client error\n');
  process.exit(1);
});

export default pool;
