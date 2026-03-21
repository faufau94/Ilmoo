import type { FastifyPluginAsync } from 'fastify';
import { getOne } from '../db/queries.js';
import { requireLinked } from '../middleware/requireLinked.js';
import type { UserRow } from '../middleware/auth.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ════════════════════════════════════════
  // POST /api/auth/register
  // Called automatically at first launch (anonymous account).
  // The auth middleware already creates the user, so this just returns it.
  // ════════════════════════════════════════
  fastify.post('/api/auth/register', async (request) => {
    return { success: true, data: request.user };
  });

  // ════════════════════════════════════════
  // POST /api/auth/login
  // Verify token + return profile (used on subsequent launches)
  // ════════════════════════════════════════
  fastify.post('/api/auth/login', async (request) => {
    return { success: true, data: request.user };
  });

  // ════════════════════════════════════════
  // POST /api/auth/link
  // Link an anonymous account to Google/email
  // ════════════════════════════════════════
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

      // Check username uniqueness if provided
      if (username) {
        const existing = await getOne(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId],
        );
        if (existing) {
          return reply.status(409).send({ success: false, error: 'Username already taken' });
        }
      }

      // Check email uniqueness
      const existingEmail = await getOne(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId],
      );
      if (existingEmail) {
        return reply.status(409).send({ success: false, error: 'Email already in use' });
      }

      const updated = await getOne<UserRow>(
        `UPDATE users
         SET is_anonymous = false, username = COALESCE($1, username), email = $2
         WHERE id = $3
         RETURNING *`,
        [username || null, email, userId],
      );

      return { success: true, data: updated };
    },
  );

  // ════════════════════════════════════════
  // GET /api/auth/me — current profile
  // ════════════════════════════════════════
  fastify.get('/api/auth/me', async (request) => {
    return { success: true, data: request.user };
  });
};

export default authRoutes;
