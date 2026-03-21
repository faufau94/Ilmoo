import type { preHandlerHookHandler } from 'fastify';

export const requireLinked: preHandlerHookHandler = async (request, reply) => {
  if (request.user.is_anonymous) {
    return reply.status(403).send({
      success: false,
      error: 'account_link_required',
      message: 'Connecte-toi pour accéder à cette fonctionnalité',
    });
  }
};
