import type { FastifyPluginAsync } from 'fastify';
import { query, getOne } from '../db/queries.js';
import { requireAdmin } from '../middleware/admin.js';
import redis from '../services/redis.js';

interface AdminStatsRow {
  total_users: string;
  active_today: string;
  total_matches: string;
  matches_today: string;
  total_questions: string;
  pending_reports: string;
}

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require admin role
  fastify.addHook('preHandler', requireAdmin);

  // ════════════════════════════════════════
  // GET /api/admin/stats — dashboard metrics
  // ════════════════════════════════════════
  fastify.get<{ Querystring: { flavor?: string } }>(
    '/api/admin/stats',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            flavor: { type: 'string', maxLength: 50 },
          },
        },
      },
    },
    async (request) => {
      const { flavor } = request.query;
      const flavorCondition = flavor ? `AND app_flavor = '${flavor}'` : '';
      const flavorConditionMatches = flavor
        ? `AND m.player1_id IN (SELECT id FROM users WHERE app_flavor = '${flavor}')`
        : '';

      // Use parameterized queries for flavor filter
      const stats = await getOne<AdminStatsRow>(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE 1=1 ${flavor ? `AND app_flavor = $1` : ''}) as total_users,
          (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours' ${flavor ? `AND app_flavor = $1` : ''}) as active_today,
          (SELECT COUNT(*) FROM matches) as total_matches,
          (SELECT COUNT(*) FROM matches WHERE created_at > NOW() - INTERVAL '24 hours') as matches_today,
          (SELECT COUNT(*) FROM questions WHERE is_active = true) as total_questions,
          (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports`,
        flavor ? [flavor] : [],
      );

      return {
        success: true,
        data: {
          totalUsers: Number(stats?.total_users ?? 0),
          activeToday: Number(stats?.active_today ?? 0),
          totalMatches: Number(stats?.total_matches ?? 0),
          matchesToday: Number(stats?.matches_today ?? 0),
          totalQuestions: Number(stats?.total_questions ?? 0),
          pendingReports: Number(stats?.pending_reports ?? 0),
        },
      };
    },
  );

  // ════════════════════════════════════════
  // GET /api/admin/users — user list with filters
  // ════════════════════════════════════════
  fastify.get<{
    Querystring: {
      status?: string;
      role?: string;
      search?: string;
      flavor?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/api/admin/users',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            status: { type: 'string', enum: ['active', 'suspended', 'banned'] },
            role: { type: 'string', enum: ['player', 'admin'] },
            search: { type: 'string', maxLength: 100 },
            flavor: { type: 'string', maxLength: 50 },
            limit: { type: 'string', pattern: '^\\d+$' },
            offset: { type: 'string', pattern: '^\\d+$' },
          },
        },
      },
    },
    async (request) => {
      const { status, role, search, flavor, limit: rawLimit, offset: rawOffset } = request.query;
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Number(rawOffset) || 0;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      if (role) {
        conditions.push(`role = $${paramIndex++}`);
        params.push(role);
      }
      if (flavor) {
        conditions.push(`app_flavor = $${paramIndex++}`);
        params.push(flavor);
      }
      if (search) {
        conditions.push(`(username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await query(
        `SELECT COUNT(*) as total FROM users ${where}`,
        params,
      );
      const total = Number(countResult.rows[0]?.total ?? 0);

      const result = await query(
        `SELECT id, firebase_uid, username, email, role, status, subscription,
                is_anonymous, app_flavor, total_matches, total_wins, total_xp, level,
                created_at, last_login_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset],
      );

      return {
        success: true,
        data: result.rows,
        pagination: { total, limit, offset },
      };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/admin/users/:id/status
  // ════════════════════════════════════════
  fastify.put<{ Params: { id: string }; Body: { status: 'active' | 'suspended' | 'banned' } }>(
    '/api/admin/users/:id/status',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object' as const,
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['active', 'suspended', 'banned'] },
          },
        },
      },
    },
    async (request, reply) => {
      const updated = await getOne(
        `UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status`,
        [request.body.status, request.params.id],
      );

      if (!updated) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // GET /api/admin/reports — pending reports
  // ════════════════════════════════════════
  fastify.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    '/api/admin/reports',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            status: { type: 'string', enum: ['pending', 'resolved', 'rejected'] },
            limit: { type: 'string', pattern: '^\\d+$' },
            offset: { type: 'string', pattern: '^\\d+$' },
          },
        },
      },
    },
    async (request) => {
      const { status: reportStatus, limit: rawLimit, offset: rawOffset } = request.query;
      const limit = Math.min(Number(rawLimit) || 50, 200);
      const offset = Number(rawOffset) || 0;
      const statusFilter = reportStatus || 'pending';

      const result = await query(
        `SELECT r.*, u.username as reporter_username,
                q.question_text as reported_question_text,
                ru.username as reported_username
         FROM reports r
         JOIN users u ON u.id = r.reporter_id
         LEFT JOIN questions q ON q.id = r.question_id
         LEFT JOIN users ru ON ru.id = r.reported_user_id
         WHERE r.status = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [statusFilter, limit, offset],
      );

      return { success: true, data: result.rows };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/admin/reports/:id — resolve report
  // ════════════════════════════════════════
  fastify.put<{
    Params: { id: string };
    Body: { status: 'resolved' | 'rejected'; admin_note?: string };
  }>(
    '/api/admin/reports/:id',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object' as const,
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['resolved', 'rejected'] },
            admin_note: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const updated = await getOne(
        `UPDATE reports
         SET status = $1, admin_note = $2, resolved_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [request.body.status, request.body.admin_note || null, request.params.id],
      );

      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Report not found' });
      }

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // GET /api/admin/flavors — list all flavors
  // ════════════════════════════════════════
  fastify.get('/api/admin/flavors', async () => {
    const result = await query(
      `SELECT * FROM app_flavors ORDER BY slug`,
    );
    return { success: true, data: result.rows };
  });

  // ════════════════════════════════════════
  // GET /api/admin/flavors/:slug — flavor detail
  // ════════════════════════════════════════
  fastify.get<{ Params: { slug: string } }>(
    '/api/admin/flavors/:slug',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['slug'],
          properties: {
            slug: { type: 'string', minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const flavor = await getOne(
        `SELECT * FROM app_flavors WHERE slug = $1`,
        [request.params.slug],
      );

      if (!flavor) {
        return reply.status(404).send({ success: false, error: 'Flavor not found' });
      }

      return { success: true, data: flavor };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/admin/flavors/:slug — update flavor
  // ════════════════════════════════════════
  fastify.put<{
    Params: { slug: string };
    Body: Record<string, unknown>;
  }>(
    '/api/admin/flavors/:slug',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['slug'],
          properties: {
            slug: { type: 'string', minLength: 1, maxLength: 50 },
          },
        },
        body: {
          type: 'object' as const,
          properties: {
            app_name: { type: 'string', minLength: 1, maxLength: 100 },
            app_description: { type: 'string' },
            support_email: { type: 'string', maxLength: 255 },
            primary_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            primary_dark: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            accent_positive: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            accent_negative: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            enabled_category_ids: {
              oneOf: [
                { type: 'array', items: { type: 'string', format: 'uuid' } },
                { type: 'null' },
              ],
            },
            ads_enabled: { type: 'boolean' },
            premium_enabled: { type: 'boolean' },
            tournaments_enabled: { type: 'boolean' },
            friends_enabled: { type: 'boolean' },
            is_active: { type: 'boolean' },
            maintenance_message: { type: ['string', 'null'] },
            min_app_version: { type: ['string', 'null'] },
            app_store_url: { type: ['string', 'null'] },
            play_store_url: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const body = request.body;

      const existing = await getOne('SELECT id FROM app_flavors WHERE slug = $1', [slug]);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Flavor not found' });
      }

      const allowedFields = [
        'app_name', 'app_description', 'support_email',
        'primary_color', 'primary_dark', 'accent_positive', 'accent_negative',
        'enabled_category_ids',
        'ads_enabled', 'premium_enabled', 'tournaments_enabled', 'friends_enabled',
        'is_active', 'maintenance_message', 'min_app_version',
        'app_store_url', 'play_store_url',
      ];

      const sets: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          sets.push(`${field} = $${paramIndex++}`);
          params.push(body[field]);
        }
      }

      if (sets.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update' });
      }

      params.push(slug);
      const updated = await getOne(
        `UPDATE app_flavors SET ${sets.join(', ')} WHERE slug = $${paramIndex} RETURNING *`,
        params,
      );

      // Invalidate Redis cache so apps get fresh config
      await redis.del(`config:${slug}`);

      return { success: true, data: updated };
    },
  );
};

export default adminRoutes;
