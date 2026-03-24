import type { FastifyPluginAsync } from 'fastify';
import { eq, and, ne } from 'drizzle-orm';
import { db, users } from '../db/index.js';
import { requireLinked } from '../middleware/requireLinked.js';
import type { UserRow } from '../middleware/auth.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (request) => {
    return { success: true, data: request.user };
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request) => {
    return { success: true, data: request.user };
  });

  // POST /api/auth/link
  fastify.post<{ Body: { username: string; email: string } }>(
    '/api/auth/link',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['email'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_]+$' },
            email: { type: 'string', format: 'email', maxLength: 255 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, email } = request.body;
      const userId = request.user.id;

      if (username) {
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, username), ne(users.id, userId)))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (existing) {
          return reply.status(409).send({ success: false, error: 'Username already taken' });
        }
      }

      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, userId)))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (existingEmail) {
        return reply.status(409).send({ success: false, error: 'Email already in use' });
      }

      const updated = await db
        .update(users)
        .set({ isAnonymous: false, username: username || undefined, email })
        .where(eq(users.id, userId))
        .returning();

      return { success: true, data: updated[0] };
    },
  );

  // GET /api/auth/me
  fastify.get('/api/auth/me', async (request) => {
    return { success: true, data: request.user };
  });
};

export default authRoutes;
