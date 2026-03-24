import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { eq, and, gt } from 'drizzle-orm';
import { verifyToken } from '../services/firebase.js';
import { db, users, adminSessions } from '../db/index.js';

export type UserRow = typeof users.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null as unknown as UserRow);

  fastify.addHook('onRequest', async (request, reply) => {
    const routePath = request.routeOptions.url;
    if (routePath === '/health' || routePath === '/api/config/:flavorSlug' || routePath === '/api/admin/login') {
      return;
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.slice(7);

    // Try admin session token first (for backoffice)
    const adminSession = await db
      .select({ userId: adminSessions.userId })
      .from(adminSessions)
      .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    let user: UserRow | null = null;

    if (adminSession) {
      user = await db
        .select()
        .from(users)
        .where(eq(users.id, adminSession.userId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    } else {
      let firebaseUid: string;
      try {
        const decoded = await verifyToken(token);
        firebaseUid = decoded.uid;
      } catch {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token',
        });
      }

      user = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!user) {
        const appFlavor = (request.headers['x-app-flavor'] as string) || null;

        const inserted = await db
          .insert(users)
          .values({ firebaseUid, isAnonymous: true, appFlavor, lastLoginAt: new Date() })
          .returning();
        user = inserted[0]!;
      } else {
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));
      }
    }

    if (user!.status === 'banned') {
      return reply.status(403).send({ success: false, error: 'Account banned' });
    }
    if (user!.status === 'suspended') {
      return reply.status(403).send({ success: false, error: 'Account suspended' });
    }

    request.user = user!;
  });
};

export default fp(authPlugin, { name: 'auth' });
