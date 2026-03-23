import type { FastifyPluginAsync } from 'fastify';
import { query, getOne, transaction } from '../db/queries.js';
import { requireAdmin } from '../middleware/admin.js';

interface QuestionRow {
  id: string;
  category_id: string;
  question_text: string;
  answers: string[];
  correct_index: number;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string | null;
  times_played: number;
  times_correct: number;
  is_active: boolean;
  is_verified: boolean;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_slug?: string;
}

// ── GET /api/questions ──
// List questions with pagination and filters
interface ListQuery {
  categoryId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  search?: string;
  isVerified?: string;       // 'true' | 'false'
  minPlayed?: string;        // filtre times_played >= n
  maxSuccessRate?: string;   // filtre taux réussite <= n (%)
  minSuccessRate?: string;   // filtre taux réussite >= n (%)
  limit?: string;
  offset?: string;
}

// ── GET /api/questions/random ──
interface RandomQuery {
  categoryId: string;
  count?: string;
  userId?: string;
}

// ── POST /api/questions ──
interface CreateBody {
  question_text: string;
  answers: string[];
  correct_index: number;
  category_id: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string;
}

// ── POST /api/questions/import ──
interface ImportBody {
  questions: CreateBody[];
}

const questionsRoutes: FastifyPluginAsync = async (fastify) => {
  // ════════════════════════════════════════
  // GET /api/questions — paginated list
  // ════════════════════════════════════════
  fastify.get<{ Querystring: ListQuery }>(
    '/api/questions',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            categoryId: { type: 'string', format: 'uuid' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            search: { type: 'string', maxLength: 200 },
            isVerified: { type: 'string', enum: ['true', 'false'] },
            minPlayed: { type: 'string', pattern: '^\\d+$' },
            minSuccessRate: { type: 'string', pattern: '^\\d+$' },
            maxSuccessRate: { type: 'string', pattern: '^\\d+$' },
            limit: { type: 'string', pattern: '^\\d+$' },
            offset: { type: 'string', pattern: '^\\d+$' },
          },
        },
      },
    },
    async (request) => {
      const {
        categoryId, difficulty, search,
        isVerified, minPlayed, minSuccessRate, maxSuccessRate,
        limit: rawLimit, offset: rawOffset,
      } = request.query;
      const limit = Math.min(Number(rawLimit) || 20, 100);
      const offset = Number(rawOffset) || 0;

      const conditions: string[] = ['q.is_active = true'];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (categoryId) {
        conditions.push(`q.category_id = $${paramIndex++}`);
        params.push(categoryId);
      }
      if (difficulty) {
        conditions.push(`q.difficulty = $${paramIndex++}`);
        params.push(difficulty);
      }
      if (search) {
        conditions.push(`(q.question_text ILIKE $${paramIndex} OR q.answers::text ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }
      if (isVerified !== undefined) {
        conditions.push(`q.is_verified = $${paramIndex++}`);
        params.push(isVerified === 'true');
      }
      if (minPlayed) {
        conditions.push(`q.times_played >= $${paramIndex++}`);
        params.push(Number(minPlayed));
      }
      if (minSuccessRate) {
        conditions.push(`(q.times_played = 0 OR ROUND(q.times_correct::numeric / q.times_played * 100) >= $${paramIndex++})`);
        params.push(Number(minSuccessRate));
      }
      if (maxSuccessRate) {
        conditions.push(`(q.times_played > 0 AND ROUND(q.times_correct::numeric / q.times_played * 100) <= $${paramIndex++})`);
        params.push(Number(maxSuccessRate));
      }

      const where = conditions.join(' AND ');

      const countResult = await query(
        `SELECT COUNT(*) as total FROM questions q WHERE ${where}`,
        params,
      );
      const total = Number(countResult.rows[0]?.total ?? 0);

      const result = await query<QuestionRow>(
        `SELECT q.*, c.name as category_name, c.slug as category_slug
         FROM questions q
         JOIN categories c ON c.id = q.category_id
         WHERE ${where}
         ORDER BY q.created_at DESC
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
  // GET /api/questions/random
  // ════════════════════════════════════════
  fastify.get<{ Querystring: RandomQuery }>(
    '/api/questions/random',
    {
      schema: {
        querystring: {
          type: 'object' as const,
          required: ['categoryId'],
          properties: {
            categoryId: { type: 'string', format: 'uuid' },
            count: { type: 'string', pattern: '^\\d+$' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request) => {
      const { categoryId, count: rawCount, userId } = request.query;
      const count = Math.min(Number(rawCount) || 7, 20);

      // Check if this is a root category with subcategories
      const subcategories = await query(
        `SELECT id FROM categories WHERE parent_id = $1 AND is_active = true`,
        [categoryId],
      );

      // Build category filter: root → all subcategories, leaf → just this one
      let categoryFilter: string;
      const categoryIds: string[] = [];

      if (subcategories.rows.length > 0) {
        // Root category: include the root + all its subcategories
        categoryIds.push(categoryId, ...subcategories.rows.map((r) => r.id as string));
        const placeholders = categoryIds.map((_, i) => `$${i + 1}`).join(', ');
        categoryFilter = `q.category_id IN (${placeholders})`;
      } else {
        // Leaf category (or root with no subcategories)
        categoryIds.push(categoryId);
        categoryFilter = `q.category_id = $1`;
      }

      const baseParamCount = categoryIds.length;

      // Try to exclude already-seen questions for this user
      let questions;
      if (userId) {
        questions = await query<QuestionRow>(
          `SELECT q.*
           FROM questions q
           WHERE ${categoryFilter}
             AND q.is_active = true
             AND q.id NOT IN (
               SELECT question_id FROM user_seen_questions WHERE user_id = $${baseParamCount + 1}
             )
           ORDER BY RANDOM()
           LIMIT $${baseParamCount + 2}`,
          [...categoryIds, userId, count],
        );

        // Not enough unseen questions → reset and re-pick
        if (questions.rows.length < count) {
          await query(
            `DELETE FROM user_seen_questions
             WHERE user_id = $1
               AND question_id IN (
                 SELECT id FROM questions WHERE ${categoryFilter.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)}
               )`,
            [userId, ...categoryIds],
          );

          questions = await query<QuestionRow>(
            `SELECT q.*
             FROM questions q
             WHERE ${categoryFilter}
               AND q.is_active = true
             ORDER BY RANDOM()
             LIMIT $${baseParamCount + 1}`,
            [...categoryIds, count],
          );
        }
      } else {
        questions = await query<QuestionRow>(
          `SELECT q.*
           FROM questions q
           WHERE ${categoryFilter}
             AND q.is_active = true
           ORDER BY RANDOM()
           LIMIT $${baseParamCount + 1}`,
          [...categoryIds, count],
        );
      }

      return {
        success: true,
        data: questions.rows,
      };
    },
  );

  // ════════════════════════════════════════
  // GET /api/questions/:id
  // ════════════════════════════════════════
  fastify.get<{ Params: { id: string } }>(
    '/api/questions/:id',
    {
      schema: {
        params: {
          type: 'object' as const,
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const question = await getOne<QuestionRow>(
        `SELECT q.*, c.name as category_name, c.slug as category_slug
         FROM questions q
         JOIN categories c ON c.id = q.category_id
         WHERE q.id = $1 AND q.is_active = true`,
        [request.params.id],
      );

      if (!question) {
        return reply.status(404).send({ success: false, error: 'Question not found' });
      }

      return { success: true, data: question };
    },
  );

  // ════════════════════════════════════════
  // POST /api/questions — admin only
  // ════════════════════════════════════════
  fastify.post<{ Body: CreateBody }>(
    '/api/questions',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['question_text', 'answers', 'correct_index', 'category_id'],
          properties: {
            question_text: { type: 'string', minLength: 1 },
            answers: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              minItems: 4,
              maxItems: 4,
            },
            correct_index: { type: 'integer', minimum: 0, maximum: 3 },
            category_id: { type: 'string', format: 'uuid' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            explanation: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { question_text, answers, correct_index, category_id, difficulty, explanation } =
        request.body;

      // Verify category exists
      const category = await getOne('SELECT id FROM categories WHERE id = $1', [category_id]);
      if (!category) {
        return reply.status(400).send({ success: false, error: 'Category not found' });
      }

      const question = await transaction(async (client) => {
        const result = await client.query<QuestionRow>(
          `INSERT INTO questions (question_text, answers, correct_index, category_id, difficulty, explanation)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [question_text, JSON.stringify(answers), correct_index, category_id, difficulty || 'medium', explanation || null],
        );

        // Increment category question_count
        await client.query(
          `UPDATE categories SET question_count = question_count + 1 WHERE id = $1`,
          [category_id],
        );

        return result.rows[0]!;
      });

      return reply.status(201).send({ success: true, data: question });
    },
  );

  // ════════════════════════════════════════
  // PUT /api/questions/:id — admin only
  // ════════════════════════════════════════
  fastify.put<{ Params: { id: string }; Body: Partial<CreateBody> & { is_verified?: boolean } }>(
    '/api/questions/:id',
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
            question_text: { type: 'string', minLength: 1 },
            answers: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              minItems: 4,
              maxItems: 4,
            },
            correct_index: { type: 'integer', minimum: 0, maximum: 3 },
            category_id: { type: 'string', format: 'uuid' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            explanation: { type: 'string' },
            is_verified: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      // Check question exists
      const existing = await getOne<QuestionRow>(
        'SELECT * FROM questions WHERE id = $1 AND is_active = true',
        [id],
      );
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Question not found' });
      }

      // Build dynamic SET clause
      const sets: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (body.question_text !== undefined) {
        sets.push(`question_text = $${paramIndex++}`);
        params.push(body.question_text);
      }
      if (body.answers !== undefined) {
        sets.push(`answers = $${paramIndex++}`);
        params.push(JSON.stringify(body.answers));
      }
      if (body.correct_index !== undefined) {
        sets.push(`correct_index = $${paramIndex++}`);
        params.push(body.correct_index);
      }
      if (body.difficulty !== undefined) {
        sets.push(`difficulty = $${paramIndex++}`);
        params.push(body.difficulty);
      }
      if (body.explanation !== undefined) {
        sets.push(`explanation = $${paramIndex++}`);
        params.push(body.explanation);
      }
      if (body.is_verified !== undefined) {
        sets.push(`is_verified = $${paramIndex++}`);
        params.push(body.is_verified);
      }

      // Handle category change: update question_count on both categories
      if (body.category_id !== undefined && body.category_id !== existing.category_id) {
        const newCategory = await getOne('SELECT id FROM categories WHERE id = $1', [body.category_id]);
        if (!newCategory) {
          return reply.status(400).send({ success: false, error: 'Category not found' });
        }

        sets.push(`category_id = $${paramIndex++}`);
        params.push(body.category_id);

        await transaction(async (client) => {
          await client.query(
            `UPDATE categories SET question_count = question_count - 1 WHERE id = $1`,
            [existing.category_id],
          );
          await client.query(
            `UPDATE categories SET question_count = question_count + 1 WHERE id = $1`,
            [body.category_id],
          );
        });
      }

      if (sets.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update' });
      }

      params.push(id);
      const updated = await getOne<QuestionRow>(
        `UPDATE questions SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params,
      );

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // DELETE /api/questions/:id — admin only (soft delete)
  // ════════════════════════════════════════
  fastify.delete<{ Params: { id: string } }>(
    '/api/questions/:id',
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

      const question = await getOne<QuestionRow>(
        'SELECT * FROM questions WHERE id = $1 AND is_active = true',
        [id],
      );
      if (!question) {
        return reply.status(404).send({ success: false, error: 'Question not found' });
      }

      await transaction(async (client) => {
        await client.query(
          `UPDATE questions SET is_active = false WHERE id = $1`,
          [id],
        );
        await client.query(
          `UPDATE categories SET question_count = question_count - 1 WHERE id = $1`,
          [question.category_id],
        );
      });

      return { success: true, data: { deleted: true } };
    },
  );

  // ════════════════════════════════════════
  // POST /api/questions/import — admin only (batch JSON)
  // ════════════════════════════════════════
  fastify.post<{ Body: ImportBody }>(
    '/api/questions/import',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['questions'],
          properties: {
            questions: {
              type: 'array',
              minItems: 1,
              maxItems: 500,
              items: {
                type: 'object' as const,
                required: ['question_text', 'answers', 'correct_index', 'category_id'],
                properties: {
                  question_text: { type: 'string', minLength: 1 },
                  answers: {
                    type: 'array',
                    items: { type: 'string', minLength: 1 },
                    minItems: 4,
                    maxItems: 4,
                  },
                  correct_index: { type: 'integer', minimum: 0, maximum: 3 },
                  category_id: { type: 'string', format: 'uuid' },
                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                  explanation: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { questions } = request.body;
      const errors: { index: number; error: string }[] = [];
      let imported = 0;

      // Collect all category IDs to validate upfront
      const categoryIds = [...new Set(questions.map((q) => q.category_id))];
      const existingCategories = await query(
        `SELECT id FROM categories WHERE id = ANY($1)`,
        [categoryIds],
      );
      const validCategoryIds = new Set(existingCategories.rows.map((r) => r.id as string));

      // Count how many questions per category will be added
      const categoryCountMap = new Map<string, number>();

      await transaction(async (client) => {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i]!;

          if (!validCategoryIds.has(q.category_id)) {
            errors.push({ index: i, error: `Category ${q.category_id} not found` });
            continue;
          }

          try {
            await client.query(
              `INSERT INTO questions (question_text, answers, correct_index, category_id, difficulty, explanation)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                q.question_text,
                JSON.stringify(q.answers),
                q.correct_index,
                q.category_id,
                q.difficulty || 'medium',
                q.explanation || null,
              ],
            );
            imported++;
            categoryCountMap.set(q.category_id, (categoryCountMap.get(q.category_id) || 0) + 1);
          } catch (err) {
            errors.push({ index: i, error: (err as Error).message });
          }
        }

        // Update question_count for each affected category
        for (const [catId, count] of categoryCountMap) {
          await client.query(
            `UPDATE categories SET question_count = question_count + $1 WHERE id = $2`,
            [count, catId],
          );
        }
      });

      return {
        success: true,
        data: { imported, errors: errors.length > 0 ? errors : undefined },
      };
    },
  );
};

export default questionsRoutes;
