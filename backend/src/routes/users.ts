import type { FastifyPluginAsync } from 'fastify';
import { eq, and, ne, desc, inArray, sql } from 'drizzle-orm';
import { db, users, userCategoryStats, categories } from '../db/index.js';
import { requireLinked } from '../middleware/requireLinked.js';
import type { UserRow } from '../middleware/auth.js';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/users/me
  fastify.get('/api/users/me', async (request) => {
    const u = request.user;
    return {
      success: true,
      data: {
        id: u.id, username: u.username, email: u.email, role: u.role,
        status: u.status, subscription: u.subscription, is_anonymous: u.isAnonymous,
        app_flavor: u.appFlavor, total_matches: u.totalMatches, total_wins: u.totalWins,
        total_xp: u.totalXp, level: u.level, win_streak: u.winStreak,
        best_streak: u.bestStreak, created_at: u.createdAt,
      },
    };
  });

  // GET /api/users/:id — public profile
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
      const user = await db
        .select({
          id: users.id, username: users.username, isAnonymous: users.isAnonymous,
          totalMatches: users.totalMatches, totalWins: users.totalWins,
          totalXp: users.totalXp, level: users.level, bestStreak: users.bestStreak,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(eq(users.id, request.params.id), eq(users.status, 'active')))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      return { success: true, data: user };
    },
  );

  // PUT /api/users/me — update username
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

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, request.user.id)))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (existing) {
        return reply.status(409).send({ success: false, error: 'Username already taken' });
      }

      const updated = await db
        .update(users)
        .set({ username })
        .where(eq(users.id, request.user.id))
        .returning();

      return { success: true, data: updated[0] };
    },
  );

  // PUT /api/users/me/fcm-token
  fastify.put<{ Body: { fcm_token: string } }>(
    '/api/users/me/fcm-token',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['fcm_token'],
          properties: { fcm_token: { type: 'string', minLength: 1, maxLength: 500 } },
        },
      },
    },
    async (request) => {
      await db
        .update(users)
        .set({ fcmToken: request.body.fcm_token })
        .where(eq(users.id, request.user.id));
      return { success: true, data: { updated: true } };
    },
  );

  // PUT /api/users/me/subscription
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
      await db
        .update(users)
        .set({ subscription: request.body.subscription })
        .where(eq(users.id, request.user.id));
      return { success: true, data: { updated: true } };
    },
  );

  // GET /api/users/me/stats
  fastify.get('/api/users/me/stats', async (request) => {
    const result = await db
      .select({
        categoryId: userCategoryStats.categoryId,
        categoryName: categories.name,
        matchesPlayed: userCategoryStats.matchesPlayed,
        matchesWon: userCategoryStats.matchesWon,
        xp: userCategoryStats.xp,
        badge: userCategoryStats.badge,
        correctAnswers: userCategoryStats.correctAnswers,
        totalAnswers: userCategoryStats.totalAnswers,
      })
      .from(userCategoryStats)
      .innerJoin(categories, eq(categories.id, userCategoryStats.categoryId))
      .where(eq(userCategoryStats.userId, request.user.id))
      .orderBy(desc(userCategoryStats.xp));

    return { success: true, data: result };
  });

  // GET /api/leaderboard
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

      // Try Redis first for global rankings
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

            if (leaderboard.length > 0) {
              const userIds = leaderboard.map((l) => l.userId);
              const userRows = await db
                .select({
                  id: users.id, username: users.username, level: users.level,
                  totalXp: users.totalXp, isAnonymous: users.isAnonymous,
                })
                .from(users)
                .where(and(
                  inArray(users.id, userIds),
                  eq(users.isAnonymous, false),
                  eq(users.status, 'active'),
                ));
              const userMap = new Map(userRows.map((u) => [u.id, u]));

              const data = leaderboard
                .filter((l) => userMap.has(l.userId))
                .map((l, i) => ({ rank: i + 1, ...userMap.get(l.userId), score: l.score }));

              return { success: true, data };
            }
          }
        } catch {
          // Redis unavailable, fallback
        }
      }

      // Fallback: PostgreSQL
      if (categoryId) {
        const result = await db.execute(sql`
          SELECT u.id, u.username, u.level, ucs.xp as score, u.is_anonymous
          FROM user_category_stats ucs
          JOIN users u ON u.id = ucs.user_id
          WHERE ucs.category_id = ${categoryId}
            AND u.is_anonymous = false AND u.status = 'active'
          ORDER BY ucs.xp DESC
          LIMIT ${limit}
        `);
        const data = result.rows.map((row: Record<string, unknown>, i: number) => ({ rank: i + 1, ...row }));
        return { success: true, data };
      }

      // Global leaderboard
      const result = await db.execute(sql`
        SELECT u.id, u.username, u.level, u.total_xp as score, u.is_anonymous
        FROM users u
        WHERE u.is_anonymous = false AND u.status = 'active'
          ${flavorSlug ? sql`AND u.app_flavor = ${flavorSlug}` : sql``}
        ORDER BY u.total_xp DESC
        LIMIT ${limit}
      `);
      const data = result.rows.map((row: Record<string, unknown>, i: number) => ({ rank: i + 1, ...row }));
      return { success: true, data };
    },
  );
};

export default usersRoutes;
