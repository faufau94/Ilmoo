import type { preHandlerHookHandler } from 'fastify';

export const requireAdmin: preHandlerHookHandler = async (request, reply) => {
  if (request.user.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required',
    });
  }
};
