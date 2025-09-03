import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { jsonSchemaTransform, ZodTypeProvider } from 'fastify-type-provider-zod';
import { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>();

  await app.register(swagger, {
    openapi: {
      info: { title: 'Clearcost API', version: '1.0.0' },
      servers: [{ url: process.env.CLEARCOST_API_URL || 'http://localhost:3001' }],
      security: [{ ApiKeyHeader: [] }],
      components: {
        securitySchemes: {
          ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'x-api-key' },
          InternalSig: { type: 'apiKey', in: 'header', name: 'x-cc-sig' },
        },
        parameters: {
          XccTs: {
            name: 'x-cc-ts',
            in: 'header',
            required: true,
            description:
              'Unix timestamp (ms) used for internal request signing; must be within 5 minutes of server time.',
            schema: { type: 'string', example: String(Date.now()) },
          },
        },
      },
      tags: [
        { name: 'Quotes', description: 'Duty & tax estimates' },
        { name: 'Manifests', description: 'Bulk quoting' },
        { name: 'Auth', description: 'API key management' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      deepLinking: true,
      persistAuthorization: true,
    },
  });

  app.get('/openapi.json', async () => app.swagger());
};

export default swaggerPlugin;
