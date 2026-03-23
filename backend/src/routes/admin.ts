import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
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
  // ════════════════════════════════════════
  // POST /api/admin/login — public (no auth, no requireAdmin)
  // Registered directly on the parent instance to avoid the preHandler hook below
  // ════════════════════════════════════════
  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/admin/login',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await getOne<{
        id: string;
        email: string;
        username: string | null;
        role: string;
        password_hash: string | null;
      }>(
        `SELECT id, email, username, role, password_hash FROM users WHERE email = $1 AND role = 'admin'`,
        [email],
      );

      if (!user || !user.password_hash) {
        return reply.status(401).send({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await query(
        `INSERT INTO admin_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt],
      );

      return {
        success: true,
        data: {
          token,
          user: { id: user.id, email: user.email, username: user.username },
        },
      };
    },
  );

  // ── Protected admin routes (encapsulated in a sub-plugin) ──
  await fastify.register(async (f) => {
    f.addHook('preHandler', requireAdmin);

  // ════════════════════════════════════════
  // GET /api/admin/categories — all categories (including inactive)
  // ════════════════════════════════════════
  f.get('/api/admin/categories', async () => {
    const result = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.id) as subcategories_count
       FROM categories c
       ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name`,
    );

    const data = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      subcategories_count: Number(row.subcategories_count),
    }));

    return { success: true, data };
  });

  // ════════════════════════════════════════
  // GET /api/admin/matches — match history
  // ════════════════════════════════════════
  f.get<{
    Querystring: { type?: string; status?: string; limit?: string; offset?: string };
  }>(
    '/api/admin/matches',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            type: { type: 'string', enum: ['ranked', 'friendly', 'solo', 'tournament'] },
            status: { type: 'string', enum: ['waiting', 'in_progress', 'completed', 'cancelled'] },
            limit: { type: 'string', pattern: '^\\d+$' },
            offset: { type: 'string', pattern: '^\\d+$' },
          },
        },
      },
    },
    async (request) => {
      const { type, status, limit: rawLimit, offset: rawOffset } = request.query;
      const limit = Math.min(Number(rawLimit) || 30, 200);
      const offset = Number(rawOffset) || 0;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let pi = 1;

      if (type) { conditions.push(`m.match_type = $${pi++}`); params.push(type); }
      if (status) { conditions.push(`m.status = $${pi++}`); params.push(status); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await query(`SELECT COUNT(*) as total FROM matches m ${where}`, params);
      const total = Number(countResult.rows[0]?.total ?? 0);

      const result = await query(
        `SELECT m.*,
          p1.username as player1_username,
          p2.username as player2_username,
          c.name as category_name
        FROM matches m
        LEFT JOIN users p1 ON p1.id = m.player1_id
        LEFT JOIN users p2 ON p2.id = m.player2_id
        LEFT JOIN categories c ON c.id = m.category_id
        ${where}
        ORDER BY m.created_at DESC
        LIMIT $${pi++} OFFSET $${pi++}`,
        [...params, limit, offset],
      );

      return { success: true, data: result.rows, pagination: { total, limit, offset } };
    },
  );

  // ════════════════════════════════════════
  // GET /api/admin/tournaments — list tournaments
  // ════════════════════════════════════════
  f.get('/api/admin/tournaments', async () => {
    const result = await query('SELECT * FROM tournaments ORDER BY created_at DESC');
    return { success: true, data: result.rows };
  });

  // ════════════════════════════════════════
  // POST /api/admin/tournaments — create tournament
  // ════════════════════════════════════════
  f.post<{ Body: Record<string, unknown> }>(
    '/api/admin/tournaments',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            description: { type: ['string', 'null'] },
            status: { type: 'string', enum: ['draft', 'active', 'completed', 'cancelled'] },
            max_players: { type: 'integer', minimum: 2 },
            start_date: { type: ['string', 'null'] },
            end_date: { type: ['string', 'null'] },
            sponsor_name: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const b = request.body;
      const result = await getOne(
        `INSERT INTO tournaments (name, description, status, max_players, start_date, end_date, sponsor_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [b.name, b.description ?? null, b.status ?? 'draft', b.max_players ?? 100, b.start_date ?? null, b.end_date ?? null, b.sponsor_name ?? null],
      );
      return reply.status(201).send({ success: true, data: result });
    },
  );

  // ════════════════════════════════════════
  // PUT /api/admin/tournaments/:id — update tournament
  // ════════════════════════════════════════
  f.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/admin/tournaments/:id',
    {
      schema: {
        params: { type: 'object' as const, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
        body: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', minLength: 1 },
            description: { type: ['string', 'null'] },
            status: { type: 'string', enum: ['draft', 'active', 'completed', 'cancelled'] },
            max_players: { type: 'integer', minimum: 2 },
            start_date: { type: ['string', 'null'] },
            end_date: { type: ['string', 'null'] },
            sponsor_name: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const fields = ['name', 'description', 'status', 'max_players', 'start_date', 'end_date', 'sponsor_name'];
      const sets: string[] = [];
      const params: unknown[] = [];
      let pi = 1;

      for (const field of fields) {
        if (body[field] !== undefined) {
          sets.push(`${field} = $${pi++}`);
          params.push(body[field]);
        }
      }

      if (sets.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update' });
      }

      params.push(id);
      const updated = await getOne(
        `UPDATE tournaments SET ${sets.join(', ')} WHERE id = $${pi} RETURNING *`,
        params,
      );

      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Tournament not found' });
      }

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // GET /api/admin/stats — dashboard metrics
  // ════════════════════════════════════════
  f.get<{ Querystring: { flavor?: string } }>(
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
  f.get<{
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
  f.put<{ Params: { id: string }; Body: { status: 'active' | 'suspended' | 'banned' } }>(
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
  f.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
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
  f.put<{
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
  f.get('/api/admin/flavors', async () => {
    const result = await query(
      `SELECT * FROM app_flavors ORDER BY slug`,
    );
    return { success: true, data: result.rows };
  });

  // ════════════════════════════════════════
  // GET /api/admin/flavors/:slug — flavor detail
  // ════════════════════════════════════════
  f.get<{ Params: { slug: string } }>(
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
  f.put<{
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
  }); // end protected scope
};

export default adminRoutes;
