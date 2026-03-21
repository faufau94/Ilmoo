import type { FastifyPluginAsync } from 'fastify';
import { query, getOne } from '../db/queries.js';
import { requireLinked } from '../middleware/requireLinked.js';
import type { UserRow } from '../middleware/auth.js';

interface UserCategoryStatRow {
  category_id: string;
  category_name: string;
  matches_played: number;
  matches_won: number;
  xp: number;
  badge: string;
  correct_answers: number;
  total_answers: number;
}

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // ════════════════════════════════════════
  // GET /api/users/me — my profile + stats
  // ════════════════════════════════════════
  fastify.get('/api/users/me', async (request) => {
    const user = request.user;
    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        subscription: user.subscription,
        is_anonymous: user.is_anonymous,
        app_flavor: user.app_flavor,
        total_matches: user.total_matches,
        total_wins: user.total_wins,
        total_xp: user.total_xp,
        level: user.level,
        win_streak: user.win_streak,
        best_streak: user.best_streak,
        created_at: user.created_at,
      },
    };
  });

  // ════════════════════════════════════════
  // GET /api/users/:id — public profile
  // ════════════════════════════════════════
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const user = await getOne<UserRow>(
        `SELECT id, username, is_anonymous, total_matches, total_wins, total_xp, level, best_streak, created_at
         FROM users WHERE id = $1 AND status = 'active'`,
        [request.params.id],
      );

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      return { success: true, data: user };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/users/me — update username (linked only)
  // ════════════════════════════════════════
  fastify.put<{ Body: { username: string } }>(
    '/api/users/me',
    {
      preHandler: requireLinked,
      schema: {
        body: {
          type: 'object' as const,
          required: ['username'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_]+$' },
          },
        },
      },
    },
    async (request, reply) => {
      const { username } = request.body;

      // Check uniqueness
      const existing = await getOne(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, request.user.id],
      );
      if (existing) {
        return reply.status(409).send({ success: false, error: 'Username already taken' });
      }

      const updated = await getOne<UserRow>(
        `UPDATE users SET username = $1 WHERE id = $2 RETURNING *`,
        [username, request.user.id],
      );

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/users/me/fcm-token
  // ════════════════════════════════════════
  fastify.put<{ Body: { fcm_token: string } }>(
    '/api/users/me/fcm-token',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['fcm_token'],
          properties: {
            fcm_token: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
      },
    },
    async (request) => {
      await query(
        `UPDATE users SET fcm_token = $1 WHERE id = $2`,
        [request.body.fcm_token, request.user.id],
      );

      return { success: true, data: { updated: true } };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/users/me/subscription (linked only)
  // ════════════════════════════════════════
  fastify.put<{ Body: { subscription: 'free' | 'premium' | 'expired' } }>(
    '/api/users/me/subscription',
    {
      preHandler: requireLinked,
      schema: {
        body: {
          type: 'object' as const,
          required: ['subscription'],
          properties: {
            subscription: { type: 'string', enum: ['free', 'premium', 'expired'] },
          },
        },
      },
    },
    async (request) => {
      await query(
        `UPDATE users SET subscription = $1 WHERE id = $2`,
        [request.body.subscription, request.user.id],
      );

      return { success: true, data: { updated: true } };
    },
  );

  // ════════════════════════════════════════
  // GET /api/users/me/stats — per-category stats
  // ════════════════════════════════════════
  fastify.get('/api/users/me/stats', async (request) => {
    const result = await query<UserCategoryStatRow>(
      `SELECT ucs.*, c.name as category_name
       FROM user_category_stats ucs
       JOIN categories c ON c.id = ucs.category_id
       WHERE ucs.user_id = $1
       ORDER BY ucs.xp DESC`,
      [request.user.id],
    );

    return { success: true, data: result.rows };
  });

  // ════════════════════════════════════════
  // GET /api/leaderboard
  // ════════════════════════════════════════
  fastify.get<{
    Querystring: { categoryId?: string; period?: 'weekly' | 'alltime'; limit?: string };
  }>(
    '/api/leaderboard',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            categoryId: { type: 'string', format: 'uuid' },
            period: { type: 'string', enum: ['weekly', 'alltime'] },
            limit: { type: 'string', pattern: '^\\d+$' },
          },
        },
      },
    },
    async (request) => {
      const { categoryId, period, limit: rawLimit } = request.query;
      const limit = Math.min(Number(rawLimit) || 50, 100);
      const flavorSlug = (request.headers['x-app-flavor'] as string) || null;

      // Try Redis leaderboard first for global rankings
      if (!categoryId) {
        const scope = period === 'weekly' ? 'weekly' : 'global';
        const redisKey = flavorSlug
          ? `leaderboard:${flavorSlug}:${scope}`
          : `leaderboard:global`;

        try {
          const redis = fastify.redis;
          const topPlayers = await redis.zrevrange(redisKey, 0, limit - 1, 'WITHSCORES');

          if (topPlayers.length > 0) {
            const leaderboard: { userId: string; score: number; rank: number }[] = [];
            for (let i = 0; i < topPlayers.length; i += 2) {
              leaderboard.push({
                userId: topPlayers[i]!,
                score: Number(topPlayers[i + 1]),
                rank: i / 2 + 1,
              });
            }

            // Fetch user details for the IDs
            if (leaderboard.length > 0) {
              const userIds = leaderboard.map((l) => l.userId);
              const users = await query<UserRow>(
                `SELECT id, username, level, total_xp, is_anonymous
                 FROM users
                 WHERE id = ANY($1) AND is_anonymous = false AND status = 'active'`,
                [userIds],
              );
              const userMap = new Map(users.rows.map((u) => [u.id, u]));

              const data = leaderboard
                .filter((l) => userMap.has(l.userId))
                .map((l, i) => ({
                  rank: i + 1,
                  ...userMap.get(l.userId),
                  score: l.score,
                }));

              return { success: true, data };
            }
          }
        } catch {
          // Redis unavailable, fallback to PostgreSQL
        }
      }

      // Fallback: PostgreSQL query
      if (categoryId) {
        // Per-category leaderboard
        const result = await query(
          `SELECT u.id, u.username, u.level, ucs.xp as score, u.is_anonymous
           FROM user_category_stats ucs
           JOIN users u ON u.id = ucs.user_id
           WHERE ucs.category_id = $1
             AND u.is_anonymous = false
             AND u.status = 'active'
           ORDER BY ucs.xp DESC
           LIMIT $2`,
          [categoryId, limit],
        );

        const data = result.rows.map((row, i) => ({ rank: i + 1, ...row }));
        return { success: true, data };
      }

      // Global leaderboard from PostgreSQL
      const flavorCondition = flavorSlug ? `AND u.app_flavor = $2` : '';
      const params: unknown[] = [limit];
      if (flavorSlug) params.push(flavorSlug);

      const result = await query(
        `SELECT u.id, u.username, u.level, u.total_xp as score, u.is_anonymous
         FROM users u
         WHERE u.is_anonymous = false
           AND u.status = 'active'
           ${flavorCondition}
         ORDER BY u.total_xp DESC
         LIMIT $1`,
        flavorSlug ? [limit, flavorSlug] : [limit],
      );

      const data = result.rows.map((row, i) => ({ rank: i + 1, ...row }));
      return { success: true, data };
    },
  );
};

export default usersRoutes;
