import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken } from '../services/firebase.js';
import { getOne } from '../db/queries.js';

export interface UserRow {
  id: string;
  firebase_uid: string;
  username: string | null;
  email: string | null;
  role: 'player' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  subscription: 'free' | 'premium' | 'expired';
  is_anonymous: boolean;
  app_flavor: string | null;
  total_matches: number;
  total_wins: number;
  total_xp: number;
  level: number;
  win_streak: number;
  best_streak: number;
  daily_matches: number;
  last_match_date: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null as unknown as UserRow);

  fastify.addHook('onRequest', async (request, reply) => {
    // Skip public routes (match on Fastify route pattern, not raw URL)
    const routePath = request.routeOptions.url;
    if (routePath === '/health' || routePath === '/api/config/:flavorSlug') {
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

    // Look up existing user
    let user = await getOne<UserRow>(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebaseUid],
    );

    if (!user) {
      // First connection — auto-create anonymous account
      const appFlavor = (request.headers['x-app-flavor'] as string) || null;

      user = await getOne<UserRow>(
        `INSERT INTO users (firebase_uid, is_anonymous, app_flavor, last_login_at)
         VALUES ($1, true, $2, NOW())
         RETURNING *`,
        [firebaseUid, appFlavor],
      );
    } else {
      // Update last_login_at
      await getOne(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id],
      );
    }

    // Block banned/suspended accounts
    if (user!.status === 'banned') {
      return reply.status(403).send({
        success: false,
        error: 'Account banned',
      });
    }
    if (user!.status === 'suspended') {
      return reply.status(403).send({
        success: false,
        error: 'Account suspended',
      });
    }

    request.user = user!;
  });
};

export default fp(authPlugin, { name: 'auth' });
