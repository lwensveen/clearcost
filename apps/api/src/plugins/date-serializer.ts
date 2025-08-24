import { FastifyPluginAsync } from 'fastify';

function transformDates(obj: any): any {
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(transformDates);
  }
  if (obj && typeof obj === 'object') {
    const transformed: Record<string, any> = {};
    for (const key in obj) {
      transformed[key] = transformDates(obj[key]);
    }
    return transformed;
  }
  return obj;
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
