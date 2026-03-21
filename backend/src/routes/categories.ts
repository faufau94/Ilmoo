import type { FastifyPluginAsync } from 'fastify';
import { query, getOne, transaction } from '../db/queries.js';
import { requireAdmin } from '../middleware/admin.js';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon_name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_premium: boolean;
  is_thematic: boolean;
  question_count: number;
  match_count: number;
  created_at: string;
  updated_at: string;
  subcategories_count?: number;
}

interface CreateCategoryBody {
  name: string;
  slug: string;
  parent_id?: string;
  description?: string;
  icon_name: string;
  color: string;
  sort_order?: number;
  is_premium?: boolean;
  is_thematic?: boolean;
}

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // ════════════════════════════════════════
  // GET /api/categories — root categories
  // ════════════════════════════════════════
  fastify.get('/api/categories', async () => {
    const result = await query<CategoryRow & { subcategories_count: string }>(
      `SELECT c.*,
        (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.id AND sub.is_active = true) as subcategories_count
       FROM categories c
       WHERE c.parent_id IS NULL AND c.is_active = true
       ORDER BY c.sort_order, c.name`,
    );

    const data = result.rows.map((row) => ({
      ...row,
      subcategories_count: Number(row.subcategories_count),
    }));

    return { success: true, data };
  });

  // ════════════════════════════════════════
  // GET /api/categories/:slug — detail with subcategories
  // ════════════════════════════════════════
  fastify.get<{ Params: { slug: string } }>(
    '/api/categories/:slug',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['slug'],
          properties: {
            slug: { type: 'string', minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const category = await getOne<CategoryRow>(
        `SELECT * FROM categories WHERE slug = $1 AND is_active = true`,
        [request.params.slug],
      );

      if (!category) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      // If root category, include subcategories
      let subcategories: CategoryRow[] = [];
      if (!category.parent_id) {
        const subResult = await query<CategoryRow>(
          `SELECT * FROM categories
           WHERE parent_id = $1 AND is_active = true
           ORDER BY sort_order, name`,
          [category.id],
        );
        subcategories = subResult.rows;
      }

      return {
        success: true,
        data: { ...category, subcategories },
      };
    },
  );

  // ════════════════════════════════════════
  // GET /api/categories/:slug/subcategories
  // ════════════════════════════════════════
  fastify.get<{ Params: { slug: string } }>(
    '/api/categories/:slug/subcategories',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['slug'],
          properties: {
            slug: { type: 'string', minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const parent = await getOne<CategoryRow>(
        `SELECT id FROM categories WHERE slug = $1 AND is_active = true`,
        [request.params.slug],
      );

      if (!parent) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      const result = await query<CategoryRow>(
        `SELECT * FROM categories
         WHERE parent_id = $1 AND is_active = true
         ORDER BY sort_order, name`,
        [parent.id],
      );

      return { success: true, data: result.rows };
    },
  );

  // ════════════════════════════════════════
  // POST /api/categories — admin only
  // ════════════════════════════════════════
  fastify.post<{ Body: CreateCategoryBody }>(
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

      // If parent_id provided, verify it exists and is a root category
      if (parent_id) {
        const parent = await getOne<CategoryRow>(
          'SELECT id, parent_id FROM categories WHERE id = $1',
          [parent_id],
        );
        if (!parent) {
          return reply.status(400).send({ success: false, error: 'Parent category not found' });
        }
        if (parent.parent_id) {
          return reply.status(400).send({
            success: false,
            error: 'Cannot nest more than 2 levels (parent is already a subcategory)',
          });
        }
      }

      // Check slug uniqueness
      const existing = await getOne('SELECT id FROM categories WHERE slug = $1', [slug]);
      if (existing) {
        return reply.status(409).send({ success: false, error: 'Slug already exists' });
      }

      const category = await getOne<CategoryRow>(
        `INSERT INTO categories (name, slug, parent_id, description, icon_name, color, sort_order, is_premium, is_thematic)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          name, slug, parent_id || null, description || null,
          icon_name, color, sort_order ?? 0, is_premium ?? false, is_thematic ?? false,
        ],
      );

      return reply.status(201).send({ success: true, data: category });
    },
  );

  // ════════════════════════════════════════
  // PUT /api/categories/:id — admin only
  // ════════════════════════════════════════
  fastify.put<{ Params: { id: string }; Body: Partial<CreateCategoryBody> & { is_active?: boolean } }>(
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

      const existing = await getOne<CategoryRow>('SELECT * FROM categories WHERE id = $1', [id]);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      // Check slug uniqueness if changing
      if (body.slug && body.slug !== existing.slug) {
        const slugExists = await getOne('SELECT id FROM categories WHERE slug = $1 AND id != $2', [body.slug, id]);
        if (slugExists) {
          return reply.status(409).send({ success: false, error: 'Slug already exists' });
        }
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      const fields: [string, unknown][] = [
        ['name', body.name],
        ['slug', body.slug],
        ['description', body.description],
        ['icon_name', body.icon_name],
        ['color', body.color],
        ['sort_order', body.sort_order],
        ['is_premium', body.is_premium],
        ['is_thematic', body.is_thematic],
        ['is_active', body.is_active],
      ];

      for (const [col, val] of fields) {
        if (val !== undefined) {
          sets.push(`${col} = $${paramIndex++}`);
          params.push(val);
        }
      }

      if (sets.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update' });
      }

      params.push(id);
      const updated = await getOne<CategoryRow>(
        `UPDATE categories SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params,
      );

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // DELETE /api/categories/:id — admin only (CASCADE)
  // ════════════════════════════════════════
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

      const category = await getOne<CategoryRow>('SELECT * FROM categories WHERE id = $1', [id]);
      if (!category) {
        return reply.status(404).send({ success: false, error: 'Category not found' });
      }

      // CASCADE: subcategories are deleted by the FK constraint
      await query('DELETE FROM categories WHERE id = $1', [id]);

      return { success: true, data: { deleted: true } };
    },
  );
};

export default categoriesRoutes;
