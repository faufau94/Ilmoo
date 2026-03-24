import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, users, adminSessions, categories, questions, matches, tournaments, reports, appFlavors, categoryFlavors } from '../db/index.js';
import { requireAdmin } from '../middleware/admin.js';
import redis from '../services/redis.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/admin/login — public
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

      const user = await db
        .select({
          id: users.id, email: users.email, username: users.username,
          role: users.role, passwordHash: users.passwordHash,
        })
        .from(users)
        .where(and(eq(users.email, email), eq(users.role, 'admin')))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(adminSessions).values({ userId: user.id, token, expiresAt });

      return {
        success: true,
        data: {
          token,
          user: { id: user.id, email: user.email, username: user.username },
        },
      };
    },
  );

  // Protected admin routes
  await fastify.register(async (f) => {
    f.addHook('preHandler', requireAdmin);

    // GET /api/admin/categories — all categories (including inactive)
    f.get('/api/admin/categories', async () => {
      const result = await db.execute(sql`
        SELECT c.*,
          (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.id) as subcategories_count,
          (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id AND q.is_active = true) as question_count,
          COALESCE(
            (SELECT array_agg(cf.flavor_slug) FROM category_flavors cf WHERE cf.category_id = c.id),
            ARRAY[]::varchar[]
          ) as flavor_slugs
        FROM categories c
        ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name
      `);

      const data = result.rows.map((row: Record<string, unknown>) => ({
        ...row,
        subcategories_count: Number(row.subcategories_count),
        question_count: Number(row.question_count),
      }));

      return { success: true, data };
    });

    // GET /api/admin/matches
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

        const conditions: ReturnType<typeof sql>[] = [];
        if (type) conditions.push(sql`m.match_type = ${type}`);
        if (status) conditions.push(sql`m.status = ${status}`);

        const where = conditions.length > 0
          ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
          : sql``;

        const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM matches m ${where}`);
        const total = Number((countResult.rows[0] as Record<string, unknown>)?.total ?? 0);

        const result = await db.execute(sql`
          SELECT m.*,
            p1.username as player1_username,
            p2.username as player2_username,
            c.name as category_name
          FROM matches m
          LEFT JOIN users p1 ON p1.id = m.player1_id
          LEFT JOIN users p2 ON p2.id = m.player2_id
          LEFT JOIN categories c ON c.id = m.category_id
          ${where}
          ORDER BY m.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

        return { success: true, data: result.rows, pagination: { total, limit, offset } };
      },
    );

    // GET /api/admin/tournaments
    f.get('/api/admin/tournaments', async () => {
      const result = await db
        .select()
        .from(tournaments)
        .orderBy(desc(tournaments.createdAt));
      return { success: true, data: result };
    });

    // POST /api/admin/tournaments
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
        const inserted = await db
          .insert(tournaments)
          .values({
            name: b.name as string,
            description: (b.description as string) ?? null,
            status: (b.status as 'draft' | 'active' | 'completed' | 'cancelled') ?? 'draft',
            maxPlayers: (b.max_players as number) ?? 100,
            startsAt: b.start_date ? new Date(b.start_date as string) : new Date(),
            endsAt: b.end_date ? new Date(b.end_date as string) : new Date(),
            sponsorName: (b.sponsor_name as string) ?? null,
            categoryIds: [],
          })
          .returning();
        return reply.status(201).send({ success: true, data: inserted[0] });
      },
    );

    // PUT /api/admin/tournaments/:id
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

        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.max_players !== undefined) updateData.maxPlayers = body.max_players;
        if (body.start_date !== undefined) updateData.startsAt = body.start_date ? new Date(body.start_date as string) : null;
        if (body.end_date !== undefined) updateData.endsAt = body.end_date ? new Date(body.end_date as string) : null;
        if (body.sponsor_name !== undefined) updateData.sponsorName = body.sponsor_name;

        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({ success: false, error: 'No fields to update' });
        }

        const updated = await db
          .update(tournaments)
          .set(updateData)
          .where(eq(tournaments.id, id))
          .returning();

        if (updated.length === 0) {
          return reply.status(404).send({ success: false, error: 'Tournament not found' });
        }

        return { success: true, data: updated[0] };
      },
    );

    // GET /api/admin/stats
    f.get<{ Querystring: { flavor?: string } }>(
      '/api/admin/stats',
      {
        schema: {
          querystring: {
            type: 'object' as const,
            properties: { flavor: { type: 'string', maxLength: 50 } },
          },
        },
      },
      async (request) => {
        const { flavor } = request.query;

        const stats = await db.execute(sql`
          SELECT
            (SELECT COUNT(*) FROM users WHERE 1=1 ${flavor ? sql`AND app_flavor = ${flavor}` : sql``}) as total_users,
            (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours' ${flavor ? sql`AND app_flavor = ${flavor}` : sql``}) as active_today,
            (SELECT COUNT(*) FROM matches) as total_matches,
            (SELECT COUNT(*) FROM matches WHERE created_at > NOW() - INTERVAL '24 hours') as matches_today,
            (SELECT COUNT(*) FROM questions WHERE is_active = true) as total_questions,
            (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports
        `);

        const row = stats.rows[0] as Record<string, unknown>;
        return {
          success: true,
          data: {
            totalUsers: Number(row?.total_users ?? 0),
            activeToday: Number(row?.active_today ?? 0),
            totalMatches: Number(row?.total_matches ?? 0),
            matchesToday: Number(row?.matches_today ?? 0),
            totalQuestions: Number(row?.total_questions ?? 0),
            pendingReports: Number(row?.pending_reports ?? 0),
          },
        };
      },
    );

    // GET /api/admin/users
    f.get<{
      Querystring: { status?: string; role?: string; search?: string; flavor?: string; limit?: string; offset?: string };
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

        const conditions: ReturnType<typeof sql>[] = [];
        if (status) conditions.push(sql`status = ${status}`);
        if (role) conditions.push(sql`role = ${role}`);
        if (flavor) conditions.push(sql`app_flavor = ${flavor}`);
        if (search) conditions.push(sql`(username ILIKE ${`%${search}%`} OR email ILIKE ${`%${search}%`})`);

        const where = conditions.length > 0
          ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
          : sql``;

        const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM users ${where}`);
        const total = Number((countResult.rows[0] as Record<string, unknown>)?.total ?? 0);

        const result = await db.execute(sql`
          SELECT id, firebase_uid, username, email, role, status, subscription,
                 is_anonymous, app_flavor, total_matches, total_wins, total_xp, level,
                 created_at, last_login_at
          FROM users ${where}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

        return { success: true, data: result.rows, pagination: { total, limit, offset } };
      },
    );

    // PUT /api/admin/users/:id/status
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
        const updated = await db
          .update(users)
          .set({ status: request.body.status })
          .where(eq(users.id, request.params.id))
          .returning({ id: users.id, status: users.status });

        if (updated.length === 0) {
          return reply.status(404).send({ success: false, error: 'User not found' });
        }

        return { success: true, data: updated[0] };
      },
    );

    // GET /api/admin/reports
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

        const result = await db.execute(sql`
          SELECT r.*, u.username as reporter_username,
                 q.question_text as reported_question_text,
                 ru.username as reported_username
          FROM reports r
          JOIN users u ON u.id = r.reporter_id
          LEFT JOIN questions q ON q.id = r.question_id
          LEFT JOIN users ru ON ru.id = r.reported_user_id
          WHERE r.status = ${statusFilter}
          ORDER BY r.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

        return { success: true, data: result.rows };
      },
    );

    // PUT /api/admin/reports/:id
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
        const updated = await db
          .update(reports)
          .set({
            status: request.body.status,
            adminNote: request.body.admin_note ?? null,
            resolvedAt: new Date(),
          })
          .where(eq(reports.id, request.params.id))
          .returning();

        if (updated.length === 0) {
          return reply.status(404).send({ success: false, error: 'Report not found' });
        }

        return { success: true, data: updated[0] };
      },
    );

    // GET /api/admin/flavors
    f.get('/api/admin/flavors', async () => {
      const result = await db
        .select()
        .from(appFlavors)
        .orderBy(appFlavors.slug);
      return { success: true, data: result };
    });

    // GET /api/admin/flavors/:slug
    f.get<{ Params: { slug: string } }>(
      '/api/admin/flavors/:slug',
      {
        schema: {
          params: {
            type: 'object' as const,
            required: ['slug'],
            properties: { slug: { type: 'string', minLength: 1, maxLength: 50 } },
          },
        },
      },
      async (request, reply) => {
        const flavor = await db
          .select()
          .from(appFlavors)
          .where(eq(appFlavors.slug, request.params.slug))
          .limit(1)
          .then((r) => r[0] ?? null);

        if (!flavor) {
          return reply.status(404).send({ success: false, error: 'Flavor not found' });
        }

        return { success: true, data: flavor };
      },
    );

    // PUT /api/admin/flavors/:slug
    f.put<{ Params: { slug: string }; Body: Record<string, unknown> }>(
      '/api/admin/flavors/:slug',
      {
        schema: {
          params: {
            type: 'object' as const,
            required: ['slug'],
            properties: { slug: { type: 'string', minLength: 1, maxLength: 50 } },
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
              // Gameplay
              free_daily_matches: { type: 'integer', minimum: 1, maximum: 100 },
              round_count: { type: 'integer', minimum: 1, maximum: 20 },
              timer_seconds: { type: 'integer', minimum: 5, maximum: 60 },
              bonus_round_enabled: { type: 'boolean' },
              matchmaking_timeout_seconds: { type: 'integer', minimum: 5, maximum: 120 },
              // Scoring
              points_per_round: { type: 'integer', minimum: 0 },
              points_bonus_round: { type: 'integer', minimum: 0 },
              speed_weight: { type: 'number', minimum: 0, maximum: 1 },
              base_weight: { type: 'number', minimum: 0, maximum: 1 },
              min_correct_points: { type: 'integer', minimum: 0 },
              // Progression
              xp_base_match: { type: 'integer', minimum: 0 },
              xp_win_bonus: { type: 'integer', minimum: 0 },
              xp_perfect_bonus: { type: 'integer', minimum: 0 },
              xp_streak_multiplier: { type: 'integer', minimum: 0 },
              level_formula_divisor: { type: 'integer', minimum: 1 },
              badge_thresholds: { type: 'object' },
              // Texts
              custom_texts: { type: 'object' },
            },
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params;
        const body = request.body;

        const existing = await db
          .select({ id: appFlavors.id })
          .from(appFlavors)
          .where(eq(appFlavors.slug, slug))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (!existing) {
          return reply.status(404).send({ success: false, error: 'Flavor not found' });
        }

        // Map snake_case body keys to camelCase schema keys
        const fieldMap: Record<string, string> = {
          app_name: 'appName', app_description: 'appDescription', support_email: 'supportEmail',
          primary_color: 'primaryColor', primary_dark: 'primaryDark',
          accent_positive: 'accentPositive', accent_negative: 'accentNegative',
          enabled_category_ids: 'enabledCategoryIds',
          ads_enabled: 'adsEnabled', premium_enabled: 'premiumEnabled',
          tournaments_enabled: 'tournamentsEnabled', friends_enabled: 'friendsEnabled',
          is_active: 'isActive', maintenance_message: 'maintenanceMessage',
          min_app_version: 'minAppVersion', app_store_url: 'appStoreUrl', play_store_url: 'playStoreUrl',
          // Gameplay
          free_daily_matches: 'freeDailyMatches', round_count: 'roundCount',
          timer_seconds: 'timerSeconds', bonus_round_enabled: 'bonusRoundEnabled',
          matchmaking_timeout_seconds: 'matchmakingTimeoutSeconds',
          // Scoring
          points_per_round: 'pointsPerRound', points_bonus_round: 'pointsBonusRound',
          speed_weight: 'speedWeight', base_weight: 'baseWeight',
          min_correct_points: 'minCorrectPoints',
          // Progression
          xp_base_match: 'xpBaseMatch', xp_win_bonus: 'xpWinBonus',
          xp_perfect_bonus: 'xpPerfectBonus', xp_streak_multiplier: 'xpStreakMultiplier',
          level_formula_divisor: 'levelFormulaDivisor', badge_thresholds: 'badgeThresholds',
          // Texts
          custom_texts: 'customTexts',
        };

        const updateData: Record<string, unknown> = {};
        for (const [bodyKey, schemaKey] of Object.entries(fieldMap)) {
          if (body[bodyKey] !== undefined) {
            // speed_weight & base_weight are stored as varchar
            if (bodyKey === 'speed_weight' || bodyKey === 'base_weight') {
              updateData[schemaKey] = String(body[bodyKey]);
            } else {
              updateData[schemaKey] = body[bodyKey];
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({ success: false, error: 'No fields to update' });
        }

        const updated = await db
          .update(appFlavors)
          .set(updateData)
          .where(eq(appFlavors.slug, slug))
          .returning();

        await redis.del(`config:${slug}`);

        return { success: true, data: updated[0] };
      },
    );

    // PUT /api/admin/categories/bulk-flavors — assign/remove flavor associations for categories
    f.put<{
      Body: {
        category_ids: string[];
        action: 'add' | 'remove';
        flavor_slugs: string[];
      };
    }>(
      '/api/admin/categories/bulk-flavors',
      {
        schema: {
          body: {
            type: 'object' as const,
            required: ['category_ids', 'action', 'flavor_slugs'],
            properties: {
              category_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 500 },
              action: { type: 'string', enum: ['add', 'remove'] },
              flavor_slugs: { type: 'array', items: { type: 'string', maxLength: 50 }, minItems: 1 },
            },
          },
        },
      },
      async (request) => {
        const { category_ids, action, flavor_slugs } = request.body;

        if (action === 'add') {
          const values = category_ids.flatMap((catId) =>
            flavor_slugs.map((slug) => ({ categoryId: catId, flavorSlug: slug })),
          );
          await db
            .insert(categoryFlavors)
            .values(values)
            .onConflictDoNothing();
        } else {
          const catIdArray = `{${category_ids.join(',')}}`;
          const slugArray = `{${flavor_slugs.join(',')}}`;
          await db.execute(sql`
            DELETE FROM category_flavors
            WHERE category_id = ANY(${catIdArray}::uuid[])
              AND flavor_slug = ANY(${slugArray}::varchar[])
          `);
        }

        // Invalidate config cache for affected flavors
        for (const slug of flavor_slugs) {
          await redis.del(`config:${slug}`);
        }

        return { success: true, data: { updated: category_ids.length } };
      },
    );

    // GET /api/admin/profile
    f.get('/api/admin/profile', async (request) => {
      const user = await db
        .select({ id: users.id, username: users.username, email: users.email })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1)
        .then((r) => r[0] ?? null);
      return { success: true, data: user };
    });

    // PUT /api/admin/profile
    f.put<{ Body: { username?: string; email?: string } }>(
      '/api/admin/profile',
      {
        schema: {
          body: {
            type: 'object' as const,
            properties: {
              username: { type: 'string', minLength: 1, maxLength: 50 },
              email: { type: 'string', format: 'email' },
            },
          },
        },
      },
      async (request, reply) => {
        const { username, email } = request.body;
        const updateData: Record<string, unknown> = {};
        if (username !== undefined) updateData.username = username;
        if (email !== undefined) updateData.email = email;
        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({ success: false, error: 'Rien à modifier' });
        }

        const updated = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, request.user.id))
          .returning({ id: users.id, username: users.username, email: users.email });

        return { success: true, data: updated[0] };
      },
    );

    // PUT /api/admin/password
    f.put<{ Body: { current_password: string; new_password: string } }>(
      '/api/admin/password',
      {
        schema: {
          body: {
            type: 'object' as const,
            required: ['current_password', 'new_password'],
            properties: {
              current_password: { type: 'string', minLength: 1 },
              new_password: { type: 'string', minLength: 8 },
            },
          },
        },
      },
      async (request, reply) => {
        const { current_password, new_password } = request.body;

        const user = await db
          .select({ passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, request.user.id))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (!user?.passwordHash) {
          return reply.status(400).send({ success: false, error: 'Pas de mot de passe' });
        }

        const valid = await bcrypt.compare(current_password, user.passwordHash);
        if (!valid) {
          return reply.status(401).send({ success: false, error: 'Mot de passe actuel incorrect' });
        }

        const hash = await bcrypt.hash(new_password, 10);
        await db
          .update(users)
          .set({ passwordHash: hash })
          .where(eq(users.id, request.user.id));

        return { success: true, data: { message: 'Mot de passe modifié' } };
      },
    );

  }); // end protected scope
};

export default adminRoutes;
