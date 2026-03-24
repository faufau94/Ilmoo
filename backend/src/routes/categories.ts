import type { FastifyPluginAsync } from 'fastify';
import { eq, and, isNull, sql, ne } from 'drizzle-orm';
import { db, categories, questions } from '../db/index.js';
import { requireAdmin } from '../middleware/admin.js';

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/categories — root categories
  fastify.get<{ Querystring: { all?: string } }>('/api/categories', async (request) => {
    const showAll = request.query.all === 'true';

    const result = await db.execute(sql`
      SELECT c.*,
        (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.id ${showAll ? sql`` : sql`AND sub.is_active = true`}) as subcategories_count,
        (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id AND q.is_active = true) as question_count
      FROM categories c
      WHERE c.parent_id IS NULL ${showAll ? sql`` : sql`AND c.is_active = true`}
      ORDER BY c.sort_order, c.name
    `);

    const data = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      subcategories_count: Number(row.subcategories_count),
      question_count: Number(row.question_count),
    }));

    return { success: true, data };
  });

  // GET /api/categories/:slug — detail with subcategories
  fastify.get<{ Params: { slug: string } }>(
    '/api/categories/:slug',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['slug'],
          properties: { slug: { type: 'string', minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      const rows = await db.execute(sql`
        SELECT c.*,
          (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id AND q.is_active = true) as question_count
        FROM categories c WHERE c.slug = ${request.params.slug} AND c.is_active = true
      `);
      const category = rows.rows[0] as Record<string, unknown> | undefined;

      if (!category) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      let subcategories: Record<string, unknown>[] = [];
      if (!category.parent_id) {
        const subResult = await db.execute(sql`
          SELECT c.*,
            (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id AND q.is_active = true) as question_count
          FROM categories c
          WHERE c.parent_id = ${category.id as string} AND c.is_active = true
          ORDER BY c.sort_order, c.name
        `);
        subcategories = subResult.rows as Record<string, unknown>[];
      }

      return { success: true, data: { ...category, subcategories } };
    },
  );

  // GET /api/categories/:slug/subcategories
  fastify.get<{ Params: { slug: string } }>(
    '/api/categories/:slug/subcategories',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['slug'],
          properties: { slug: { type: 'string', minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      const parent = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, request.params.slug), eq(categories.isActive, true)))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!parent) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      const result = await db
        .select()
        .from(categories)
        .where(and(eq(categories.parentId, parent.id), eq(categories.isActive, true)))
        .orderBy(categories.sortOrder, categories.name);

      return { success: true, data: result };
    },
  );

  // POST /api/categories — admin only
  fastify.post<{
    Body: {
      name: string; slug: string; parent_id?: string; description?: string;
      icon_name: string; color: string; sort_order?: number;
      is_premium?: boolean; is_thematic?: boolean;
    };
  }>(
    '/api/categories',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['name', 'slug', 'icon_name', 'color'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            parent_id: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            icon_name: { type: 'string', minLength: 1, maxLength: 50 },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            sort_order: { type: 'integer', minimum: 0 },
            is_premium: { type: 'boolean' },
            is_thematic: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { name, slug, parent_id, description, icon_name, color, sort_order, is_premium, is_thematic } =
        request.body;

      if (parent_id) {
        const parent = await db
          .select({ id: categories.id, parentId: categories.parentId })
          .from(categories)
          .where(eq(categories.id, parent_id))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (!parent) {
          return reply.status(400).send({ success: false, error: 'Parent category not found' });
        }
        if (parent.parentId) {
          return reply.status(400).send({
            success: false,
            error: 'Cannot nest more than 2 levels (parent is already a subcategory)',
          });
        }
      }

      const existing = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (existing) {
        return reply.status(409).send({ success: false, error: 'Slug already exists' });
      }

      const inserted = await db
        .insert(categories)
        .values({
          name, slug, parentId: parent_id ?? null, description: description ?? null,
          iconName: icon_name, color, sortOrder: sort_order ?? 0,
          isPremium: is_premium ?? false, isThematic: is_thematic ?? false,
        })
        .returning();

      return reply.status(201).send({ success: true, data: inserted[0] });
    },
  );

  // PUT /api/categories/:id — admin only
  fastify.put<{
    Params: { id: string };
    Body: Partial<{
      name: string; slug: string; description: string; icon_name: string;
      color: string; sort_order: number; is_premium: boolean; is_thematic: boolean; is_active: boolean;
    }>;
  }>(
    '/api/categories/:id',
    {
      preHandler: requireAdmin,
      schema: {
        params: {
          type: 'object' as const,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            description: { type: 'string' },
            icon_name: { type: 'string', minLength: 1, maxLength: 50 },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            sort_order: { type: 'integer', minimum: 0 },
            is_premium: { type: 'boolean' },
            is_thematic: { type: 'boolean' },
            is_active: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const existing = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      if (body.slug && body.slug !== existing.slug) {
        const slugExists = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.slug, body.slug), ne(categories.id, id)))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (slugExists) {
          return reply.status(409).send({ success: false, error: 'Slug already exists' });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.icon_name !== undefined) updateData.iconName = body.icon_name;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.sort_order !== undefined) updateData.sortOrder = body.sort_order;
      if (body.is_premium !== undefined) updateData.isPremium = body.is_premium;
      if (body.is_thematic !== undefined) updateData.isThematic = body.is_thematic;
      if (body.is_active !== undefined) updateData.isActive = body.is_active;

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update' });
      }

      const updated = await db
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning();

      return { success: true, data: updated[0] };
    },
  );

  // DELETE /api/categories/:id — admin only (CASCADE)
  fastify.delete<{ Params: { id: string } }>(
    '/api/categories/:id',
    {
      preHandler: requireAdmin,
      schema: {
        params: {
          type: 'object' as const,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const category = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!category) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      await db.delete(categories).where(eq(categories.id, id));

      return { success: true, data: { deleted: true } };
    },
  );
};

export default categoriesRoutes;
