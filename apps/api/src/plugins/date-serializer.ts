import { FastifyPluginAsync } from 'fastify';

export function transformDates(obj: unknown, seen?: WeakSet<object>): unknown {
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (!seen) seen = new WeakSet();
  if (seen.has(obj)) return obj;
  seen.add(obj);
  if (Array.isArray(obj)) {
    return obj.map((item) => transformDates(item, seen));
  }
  const transformed: Record<string, unknown> = {};
  for (const key in obj) {
    transformed[key] = transformDates((obj as Record<string, unknown>)[key], seen);
  }
  return transformed;
}

const dateSerializerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onSend', async (request, reply, payload) => {
    try {
      return transformDates(payload);
    } catch (error) {
      fastify.log.error({ error, url: request.url }, 'onSend date transform failed');
      throw fastify.httpErrors.internalServerError('Could not serialize response dates');
    }
  });
};

export default dateSerializerPlugin;
