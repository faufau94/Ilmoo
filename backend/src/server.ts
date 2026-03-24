import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import pool from './db/connection.js';
import { db, appFlavors } from './db/index.js';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { runSeeds } from './db/seed.js';
import redis, { cacheFlavorConfig, getFlavorConfig } from './services/redis.js';
import { verifyToken } from './services/firebase.js';
import authPlugin from './middleware/auth.js';

// ── CORS origins (restrict in production) ──
const corsOrigin =
  process.env['NODE_ENV'] === 'production'
    ? ['https://admin.ilmoo.com']
    : true; // reflect request origin in dev

// ── Type augmentation ──
declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
    redis: Redis;
    io: SocketIOServer;
  }
}

/**
 * Build and configure the Fastify app without starting it.
 * Used by tests to get a testable instance.
 */
export async function buildApp(options?: { logger?: boolean }) {
  const fastify = Fastify({ logger: options?.logger ?? true });

  // ── Socket.io ──
  const io = new SocketIOServer(fastify.server, {
    cors: { origin: corsOrigin },
  });

  // Socket.io auth — verify Firebase token at handshake
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.['token'] as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = await verifyToken(token);
      socket.data['firebaseUid'] = decoded.uid;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // Expose db, redis, io on fastify instance via decorators
  fastify.decorate('db', pool);
  fastify.decorate('redis', redis);
  fastify.decorate('io', io);

  // ── CORS ──
  await fastify.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });

  // ── Rate limiting (global: 100 req/min) ──
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  // ── Auth (Firebase token verification + user upsert) ──
  await fastify.register(authPlugin);

  // ── Health check (no logging to avoid spam from Docker healthcheck) ──
  fastify.get('/health', { logLevel: 'silent' }, async () => {
    return { status: 'ok' };
  });

  // ── GET /api/config/:flavorSlug (public, no auth) ──
  fastify.get<{ Params: { flavorSlug: string } }>(
    '/api/config/:flavorSlug',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['flavorSlug'],
          properties: {
            flavorSlug: {
              type: 'string' as const,
              minLength: 1,
              maxLength: 50,
              pattern: '^[a-z0-9_-]+$',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { flavorSlug } = request.params;

      // Check Redis cache first
      const cached = await getFlavorConfig(flavorSlug);
      if (cached) {
        return { success: true, data: cached };
      }

      // Query database using Drizzle
      const row = await db
        .select({
          appName: appFlavors.appName,
          appDescription: appFlavors.appDescription,
          supportEmail: appFlavors.supportEmail,
          primaryColor: appFlavors.primaryColor,
          primaryDark: appFlavors.primaryDark,
          accentPositive: appFlavors.accentPositive,
          accentNegative: appFlavors.accentNegative,
          enabledCategoryIds: appFlavors.enabledCategoryIds,
          adsEnabled: appFlavors.adsEnabled,
          premiumEnabled: appFlavors.premiumEnabled,
          tournamentsEnabled: appFlavors.tournamentsEnabled,
          friendsEnabled: appFlavors.friendsEnabled,
          isActive: appFlavors.isActive,
          maintenanceMessage: appFlavors.maintenanceMessage,
          minAppVersion: appFlavors.minAppVersion,
          appStoreUrl: appFlavors.appStoreUrl,
          playStoreUrl: appFlavors.playStoreUrl,
        })
        .from(appFlavors)
        .where(eq(appFlavors.slug, flavorSlug))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!row) {
        return reply.status(404).send({
          success: false,
          error: 'Flavor not found',
        });
      }

      const data = row;

      // Cache in Redis for 5 minutes
      await cacheFlavorConfig(flavorSlug, data);

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

  return { fastify, io, pool, redis };
}

// ── Start server (only when run directly, not imported by tests) ──
const isMainModule = process.argv[1]?.includes('server');
if (isMainModule) {
  // Run pending Drizzle migrations before starting
  await migrate(db, { migrationsFolder: './drizzle' });

  // Run seeds (idempotent — uses ON CONFLICT, safe to re-run)
  await runSeeds();

  const { fastify } = await buildApp();
  const port = Number(process.env['PORT']) || 3000;

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

export { pool, redis };
