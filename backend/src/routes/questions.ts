import type { FastifyPluginAsync } from 'fastify';
import { eq, and, sql, inArray, notInArray } from 'drizzle-orm';
import { db, questions, categories, questionFlavors, userSeenQuestions } from '../db/index.js';
import { requireAdmin } from '../middleware/admin.js';

const questionsRoutes: FastifyPluginAsync = async (fastify) => {
  // ════════════════════════════════════════
  // GET /api/questions — paginated list
  // ════════════════════════════════════════
  fastify.get<{
    Querystring: {
      categoryId?: string; difficulty?: string; search?: string;
      isVerified?: string; minPlayed?: string; minSuccessRate?: string;
      maxSuccessRate?: string; flavorSlug?: string;
      limit?: string; offset?: string;
    };
  }>(
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
            flavorSlug: { type: 'string', maxLength: 50 },
            limit: { type: 'string', pattern: '^\\d+$' },
            offset: { type: 'string', pattern: '^\\d+$' },
          },
        },
      },
    },
    async (request) => {
      const {
        categoryId, difficulty, search,
        isVerified, minPlayed, minSuccessRate, maxSuccessRate, flavorSlug,
        limit: rawLimit, offset: rawOffset,
      } = request.query;
      const limit = Math.min(Number(rawLimit) || 20, 500);
      const offset = Number(rawOffset) || 0;

      // Build dynamic conditions using raw SQL (complex filters with dynamic params)
      const conditions: ReturnType<typeof sql>[] = [sql`q.is_active = true`];
      if (categoryId) conditions.push(sql`q.category_id = ${categoryId}`);
      if (difficulty) conditions.push(sql`q.difficulty = ${difficulty}`);
      if (search) conditions.push(sql`(q.question_text ILIKE ${`%${search}%`} OR q.answers::text ILIKE ${`%${search}%`})`);
      if (isVerified !== undefined) conditions.push(sql`q.is_verified = ${isVerified === 'true'}`);
      if (minPlayed) conditions.push(sql`q.times_played >= ${Number(minPlayed)}`);
      if (minSuccessRate) conditions.push(sql`(q.times_played = 0 OR ROUND(q.times_correct::numeric / q.times_played * 100) >= ${Number(minSuccessRate)})`);
      if (maxSuccessRate) conditions.push(sql`(q.times_played > 0 AND ROUND(q.times_correct::numeric / q.times_played * 100) <= ${Number(maxSuccessRate)})`);
      if (flavorSlug) conditions.push(sql`EXISTS (SELECT 1 FROM question_flavors qf WHERE qf.question_id = q.id AND qf.flavor_slug = ${flavorSlug})`);

      const where = sql.join(conditions, sql` AND `);

      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM questions q WHERE ${where}`);
      const total = Number((countResult.rows[0] as Record<string, unknown>)?.total ?? 0);

      const result = await db.execute(sql`
        SELECT q.*, c.name as category_name, c.slug as category_slug,
          COALESCE(
            (SELECT array_agg(qf.flavor_slug) FROM question_flavors qf WHERE qf.question_id = q.id),
            ARRAY[]::varchar[]
          ) as flavor_slugs
        FROM questions q
        JOIN categories c ON c.id = q.category_id
        WHERE ${where}
        ORDER BY q.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return { success: true, data: result.rows, pagination: { total, limit, offset } };
    },
  );

  // ════════════════════════════════════════
  // GET /api/questions/random
  // ════════════════════════════════════════
  fastify.get<{ Querystring: { categoryId: string; count?: string; userId?: string } }>(
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

      // Check for subcategories
      const subcats = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.parentId, categoryId), eq(categories.isActive, true)));

      const categoryIds = subcats.length > 0
        ? [categoryId, ...subcats.map((r) => r.id)]
        : [categoryId];

      let result;

      if (userId) {
        result = await db.execute(sql`
          SELECT q.*
          FROM questions q
          WHERE q.category_id = ANY(${categoryIds})
            AND q.is_active = true
            AND q.id NOT IN (
              SELECT question_id FROM user_seen_questions WHERE user_id = ${userId}
            )
          ORDER BY RANDOM()
          LIMIT ${count}
        `);

        if (result.rows.length < count) {
          // Reset seen questions for this user + categories
          await db.execute(sql`
            DELETE FROM user_seen_questions
            WHERE user_id = ${userId}
              AND question_id IN (
                SELECT id FROM questions WHERE category_id = ANY(${categoryIds})
              )
          `);

          result = await db.execute(sql`
            SELECT q.*
            FROM questions q
            WHERE q.category_id = ANY(${categoryIds})
              AND q.is_active = true
            ORDER BY RANDOM()
            LIMIT ${count}
          `);
        }
      } else {
        result = await db.execute(sql`
          SELECT q.*
          FROM questions q
          WHERE q.category_id = ANY(${categoryIds})
            AND q.is_active = true
          ORDER BY RANDOM()
          LIMIT ${count}
        `);
      }

      return { success: true, data: result.rows };
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
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const result = await db.execute(sql`
        SELECT q.*, c.name as category_name, c.slug as category_slug
        FROM questions q
        JOIN categories c ON c.id = q.category_id
        WHERE q.id = ${request.params.id} AND q.is_active = true
      `);
      const question = result.rows[0];

      if (!question) {
        return reply.status(404).send({ success: false, error: 'Question not found' });
      }

      return { success: true, data: question };
    },
  );

  // ════════════════════════════════════════
  // POST /api/questions — admin only
  // ════════════════════════════════════════
  fastify.post<{
    Body: {
      question_text: string; answers: string[]; correct_index: number;
      category_id: string; difficulty?: string; explanation?: string;
      flavor_ids?: string[];
    };
  }>(
    '/api/questions',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['question_text', 'answers', 'correct_index', 'category_id'],
          properties: {
            question_text: { type: 'string', minLength: 1 },
            answers: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 4, maxItems: 4 },
            correct_index: { type: 'integer', minimum: 0, maximum: 3 },
            category_id: { type: 'string', format: 'uuid' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            explanation: { type: 'string' },
            flavor_ids: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { question_text, answers, correct_index, category_id, difficulty, explanation, flavor_ids } =
        request.body;

      const category = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, category_id))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!category) {
        return reply.status(400).send({ success: false, error: 'Category not found' });
      }

      const question = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(questions)
          .values({
            questionText: question_text,
            answers,
            correctIndex: correct_index,
            categoryId: category_id,
            difficulty: (difficulty as 'easy' | 'medium' | 'hard') || 'medium',
            explanation: explanation ?? null,
          })
          .returning();

        const newQuestion = inserted[0]!;

        await tx
          .update(categories)
          .set({ questionCount: sql`${categories.questionCount} + 1` })
          .where(eq(categories.id, category_id));

        if (flavor_ids && flavor_ids.length > 0) {
          await tx
            .insert(questionFlavors)
            .values(flavor_ids.map((slug) => ({ questionId: newQuestion.id, flavorSlug: slug })))
            .onConflictDoNothing();
        }

        return newQuestion;
      });

      return reply.status(201).send({ success: true, data: question });
    },
  );

  // ════════════════════════════════════════
  // PUT /api/questions/:id — admin only
  // ════════════════════════════════════════
  fastify.put<{
    Params: { id: string };
    Body: Partial<{
      question_text: string; answers: string[]; correct_index: number;
      category_id: string; difficulty: string; explanation: string;
      is_verified: boolean; flavor_ids: string[];
    }>;
  }>(
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
            answers: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 4, maxItems: 4 },
            correct_index: { type: 'integer', minimum: 0, maximum: 3 },
            category_id: { type: 'string', format: 'uuid' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            explanation: { type: 'string' },
            is_verified: { type: 'boolean' },
            flavor_ids: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const existing = await db
        .select()
        .from(questions)
        .where(and(eq(questions.id, id), eq(questions.isActive, true)))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Question not found' });
      }

      const updateData: Record<string, unknown> = {};
      if (body.question_text !== undefined) updateData.questionText = body.question_text;
      if (body.answers !== undefined) updateData.answers = body.answers;
      if (body.correct_index !== undefined) updateData.correctIndex = body.correct_index;
      if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
      if (body.explanation !== undefined) updateData.explanation = body.explanation;
      if (body.is_verified !== undefined) updateData.isVerified = body.is_verified;

      // Handle category change
      if (body.category_id !== undefined && body.category_id !== existing.categoryId) {
        const newCategory = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.id, body.category_id))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (!newCategory) {
          return reply.status(400).send({ success: false, error: 'Category not found' });
        }

        updateData.categoryId = body.category_id;

        await db.transaction(async (tx) => {
          await tx.update(categories).set({ questionCount: sql`${categories.questionCount} - 1` }).where(eq(categories.id, existing.categoryId));
          await tx.update(categories).set({ questionCount: sql`${categories.questionCount} + 1` }).where(eq(categories.id, body.category_id!));
        });
      }

      if (Object.keys(updateData).length === 0 && body.flavor_ids === undefined) {
        return reply.status(400).send({ success: false, error: 'No fields to update' });
      }

      let updated = existing;
      if (Object.keys(updateData).length > 0) {
        const result = await db
          .update(questions)
          .set(updateData)
          .where(eq(questions.id, id))
          .returning();
        updated = result[0]!;
      }

      // Handle flavor_ids update
      if (body.flavor_ids !== undefined) {
        await db.delete(questionFlavors).where(eq(questionFlavors.questionId, id));
        if (body.flavor_ids.length > 0) {
          await db
            .insert(questionFlavors)
            .values(body.flavor_ids.map((slug) => ({ questionId: id, flavorSlug: slug })))
            .onConflictDoNothing();
        }
      }

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

      const question = await db
        .select()
        .from(questions)
        .where(and(eq(questions.id, id), eq(questions.isActive, true)))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!question) {
        return reply.status(404).send({ success: false, error: 'Question not found' });
      }

      await db.transaction(async (tx) => {
        await tx.update(questions).set({ isActive: false }).where(eq(questions.id, id));
        await tx.update(categories).set({ questionCount: sql`${categories.questionCount} - 1` }).where(eq(categories.id, question.categoryId));
      });

      return { success: true, data: { deleted: true } };
    },
  );

  // ════════════════════════════════════════
  // POST /api/questions/import — admin only (batch JSON)
  // ════════════════════════════════════════
  fastify.post<{
    Body: {
      questions: {
        question_text: string; answers: string[]; correct_index: number;
        category_id: string; difficulty?: string; explanation?: string;
      }[];
      flavor_ids?: string[];
    };
  }>(
    '/api/questions/import',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['questions'],
          properties: {
            questions: {
              type: 'array', minItems: 1, maxItems: 500,
              items: {
                type: 'object' as const,
                required: ['question_text', 'answers', 'correct_index', 'category_id'],
                properties: {
                  question_text: { type: 'string', minLength: 1 },
                  answers: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 4, maxItems: 4 },
                  correct_index: { type: 'integer', minimum: 0, maximum: 3 },
                  category_id: { type: 'string', format: 'uuid' },
                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                  explanation: { type: 'string' },
                },
              },
            },
            flavor_ids: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      const { questions: questionsData, flavor_ids } = request.body;
      const errors: { index: number; error: string }[] = [];
      let imported = 0;

      // Validate categories upfront
      const categoryIds = [...new Set(questionsData.map((q) => q.category_id))];
      const existingCats = await db
        .select({ id: categories.id })
        .from(categories)
        .where(inArray(categories.id, categoryIds));
      const validCategoryIds = new Set(existingCats.map((r) => r.id));

      const categoryCountMap = new Map<string, number>();

      await db.transaction(async (tx) => {
        for (let i = 0; i < questionsData.length; i++) {
          const q = questionsData[i]!;

          if (!validCategoryIds.has(q.category_id)) {
            errors.push({ index: i, error: `Category ${q.category_id} not found` });
            continue;
          }

          try {
            const inserted = await tx
              .insert(questions)
              .values({
                questionText: q.question_text,
                answers: q.answers,
                correctIndex: q.correct_index,
                categoryId: q.category_id,
                difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
                explanation: q.explanation ?? null,
              })
              .returning({ id: questions.id });

            const newId = inserted[0]!.id;
            imported++;
            categoryCountMap.set(q.category_id, (categoryCountMap.get(q.category_id) || 0) + 1);

            if (flavor_ids && flavor_ids.length > 0) {
              await tx
                .insert(questionFlavors)
                .values(flavor_ids.map((slug) => ({ questionId: newId, flavorSlug: slug })))
                .onConflictDoNothing();
            }
          } catch (err) {
            errors.push({ index: i, error: (err as Error).message });
          }
        }

        for (const [catId, count] of categoryCountMap) {
          await tx
            .update(categories)
            .set({ questionCount: sql`${categories.questionCount} + ${count}` })
            .where(eq(categories.id, catId));
        }
      });

      return {
        success: true,
        data: { imported, errors: errors.length > 0 ? errors : undefined },
      };
    },
  );

  // ════════════════════════════════════════
  // PUT /api/questions/bulk-flavors — admin only
  // Assign or remove flavor associations in bulk
  // ════════════════════════════════════════
  fastify.put<{
    Body: {
      question_ids: string[];
      action: 'add' | 'remove';
      flavor_slugs: string[];
    };
  }>(
    '/api/questions/bulk-flavors',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['question_ids', 'action', 'flavor_slugs'],
          properties: {
            question_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 10000 },
            action: { type: 'string', enum: ['add', 'remove'] },
            flavor_slugs: { type: 'array', items: { type: 'string', maxLength: 50 }, minItems: 1 },
          },
        },
      },
    },
    async (request) => {
      const { question_ids, action, flavor_slugs } = request.body;

      if (action === 'add') {
        const values = question_ids.flatMap((qId) =>
          flavor_slugs.map((slug) => ({ questionId: qId, flavorSlug: slug })),
        );
        await db
          .insert(questionFlavors)
          .values(values)
          .onConflictDoNothing();
      } else {
        const qIdArray = `{${question_ids.join(',')}}`;
        const slugArray = `{${flavor_slugs.join(',')}}`;
        await db.execute(sql`
          DELETE FROM question_flavors
          WHERE question_id = ANY(${qIdArray}::uuid[])
            AND flavor_slug = ANY(${slugArray}::varchar[])
        `);
      }

      return { success: true, data: { updated: question_ids.length } };
    },
  );

  // ════════════════════════════════════════
  // DELETE /api/questions/bulk — admin only (soft delete multiple)
  // ════════════════════════════════════════
  fastify.delete<{
    Body: { question_ids: string[] };
  }>(
    '/api/questions/bulk',
    {
      preHandler: requireAdmin,
      schema: {
        body: {
          type: 'object' as const,
          required: ['question_ids'],
          properties: {
            question_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 10000 },
          },
        },
      },
    },
    async (request) => {
      const { question_ids } = request.body;
      const idArray = `{${question_ids.join(',')}}`;

      // Get category counts for affected questions before deleting
      const affectedQuestions = await db.execute(sql`
        SELECT category_id, COUNT(*)::int as cnt
        FROM questions
        WHERE id = ANY(${idArray}::uuid[]) AND is_active = true
        GROUP BY category_id
      `);

      await db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE questions SET is_active = false WHERE id = ANY(${idArray}::uuid[]) AND is_active = true
        `);

        for (const row of affectedQuestions.rows as { category_id: string; cnt: number }[]) {
          await tx.update(categories).set({
            questionCount: sql`GREATEST(${categories.questionCount} - ${row.cnt}, 0)`,
          }).where(eq(categories.id, row.category_id));
        }
      });

      return { success: true, data: { deleted: question_ids.length } };
    },
  );

  // ════════════════════════════════════════
  // GET /api/questions/ids — get all IDs matching current filters (for "select all")
  // ════════════════════════════════════════
  fastify.get<{
    Querystring: {
      categoryId?: string; difficulty?: string; search?: string;
      isVerified?: string; minPlayed?: string; minSuccessRate?: string;
      maxSuccessRate?: string; flavorSlug?: string;
    };
  }>(
    '/api/questions/ids',
    {
      preHandler: requireAdmin,
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
            flavorSlug: { type: 'string', maxLength: 50 },
          },
        },
      },
    },
    async (request) => {
      const {
        categoryId, difficulty, search,
        isVerified, minPlayed, minSuccessRate, maxSuccessRate, flavorSlug,
      } = request.query;

      const conditions: ReturnType<typeof sql>[] = [sql`q.is_active = true`];
      if (categoryId) conditions.push(sql`q.category_id = ${categoryId}`);
      if (difficulty) conditions.push(sql`q.difficulty = ${difficulty}`);
      if (search) conditions.push(sql`(q.question_text ILIKE ${`%${search}%`} OR q.answers::text ILIKE ${`%${search}%`})`);
      if (isVerified !== undefined) conditions.push(sql`q.is_verified = ${isVerified === 'true'}`);
      if (minPlayed) conditions.push(sql`q.times_played >= ${Number(minPlayed)}`);
      if (minSuccessRate) conditions.push(sql`(q.times_played = 0 OR ROUND(q.times_correct::numeric / q.times_played * 100) >= ${Number(minSuccessRate)})`);
      if (maxSuccessRate) conditions.push(sql`(q.times_played > 0 AND ROUND(q.times_correct::numeric / q.times_played * 100) <= ${Number(maxSuccessRate)})`);
      if (flavorSlug) conditions.push(sql`EXISTS (SELECT 1 FROM question_flavors qf WHERE qf.question_id = q.id AND qf.flavor_slug = ${flavorSlug})`);

      const where = sql.join(conditions, sql` AND `);

      const result = await db.execute(sql`SELECT q.id FROM questions q WHERE ${where}`);
      const ids = (result.rows as { id: string }[]).map(r => r.id);

      return { success: true, data: ids };
    },
  );
};

export default questionsRoutes;
