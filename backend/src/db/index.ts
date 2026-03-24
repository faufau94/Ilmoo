import { drizzle } from 'drizzle-orm/node-postgres';
import pool from './connection.js';
import * as schema from './schema.js';

export const db = drizzle(pool, { schema });

// Re-export schema for convenience
export * from './schema.js';
