import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import pool from './db/connection.js';

// ── Fastify instance ──
const fastify = Fastify({ logger: true });

// ── Redis ──
const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

// ── Socket.io ──
const io = new SocketIOServer(fastify.server, {
  cors: { origin: '*' },
});

// Expose db, redis, io on fastify instance via decorators
fastify.decorate('db', pool);
fastify.decorate('redis', redis);
fastify.decorate('io', io);

// ── CORS ──
await fastify.register(cors, { origin: '*' });

// ── Health check ──
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// ── GET /api/config/:flavorSlug (public, no auth) ──
fastify.get<{ Params: { flavorSlug: string } }>(
  '/api/config/:flavorSlug',
  async (request, reply) => {
    const { flavorSlug } = request.params;

    // Check Redis cache first
    const cacheKey = `config:${flavorSlug}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { success: true, data: JSON.parse(cached) };
    }

    // Query database
    const result = await pool.query(
      `SELECT
        app_name, app_description, support_email,
        primary_color, primary_dark, accent_positive, accent_negative,
        enabled_category_ids,
        ads_enabled, premium_enabled, tournaments_enabled, friends_enabled,
        is_active, maintenance_message, min_app_version,
        app_store_url, play_store_url
      FROM app_flavors
      WHERE slug = $1`,
      [flavorSlug],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: 'Flavor not found',
      });
    }

    const row = result.rows[0]!;
    const data = {
      appName: row.app_name as string,
      appDescription: row.app_description as string | null,
      supportEmail: row.support_email as string | null,
      primaryColor: row.primary_color as string,
      primaryDark: row.primary_dark as string,
      accentPositive: row.accent_positive as string,
      accentNegative: row.accent_negative as string,
      enabledCategoryIds: row.enabled_category_ids as string[] | null,
      adsEnabled: row.ads_enabled as boolean,
      premiumEnabled: row.premium_enabled as boolean,
      tournamentsEnabled: row.tournaments_enabled as boolean,
      friendsEnabled: row.friends_enabled as boolean,
      isActive: row.is_active as boolean,
      maintenanceMessage: row.maintenance_message as string | null,
      minAppVersion: row.min_app_version as string | null,
      appStoreUrl: row.app_store_url as string | null,
      playStoreUrl: row.play_store_url as string | null,
    };

    // Cache in Redis for 5 minutes
    await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);

    return { success: true, data };
  },
);

// ── Auto-register route files from routes/ ──
const routesDir = path.join(import.meta.dirname, 'routes');
try {
  const files = await readdir(routesDir);
  for (const file of files) {
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const mod = await import(path.join(routesDir, file));
      if (typeof mod.default === 'function') {
        await fastify.register(mod.default);
      }
    }
  }
} catch {
  fastify.log.info('No routes directory found, skipping auto-registration');
}

// ── Start server ──
const port = Number(process.env['PORT']) || 3000;

try {
  await fastify.listen({ port, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// ── Type augmentation ──
declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
    redis: Redis;
    io: SocketIOServer;
  }
}

export { fastify, pool, redis, io };
