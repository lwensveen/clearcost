import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { jsonSchemaTransform, ZodTypeProvider } from 'fastify-type-provider-zod';
import { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>();

  await app.register(swagger, {
    openapi: {
      info: { title: 'clearcost-API', version: '0.1.0' },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
  });

  app.get('/openapi.json', async () => app.swagger());
};

export default swaggerPlugin;
