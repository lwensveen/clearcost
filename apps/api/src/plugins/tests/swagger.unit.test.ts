import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import plugin from '../swagger.js';

type SwaggerDoc = {
  openapi: string;
  info: { title: string; version: string };
  components: Record<string, unknown>;
};

type SwaggerOpts = any;
type SwaggerUiOpts = any;

const { state } = vi.hoisted(() => ({
  state: {
    swaggerOpts: null as SwaggerOpts | null,
    swaggerUiOpts: null as SwaggerUiOpts | null,
    swaggerReturn: {
      openapi: '3.0.0',
      info: { title: 'from-mock', version: 'x' },
      components: {},
    } as SwaggerDoc,
  },
}));

// Mock the swagger plugin to ONLY capture the options passed to it.
// We will manually add the .swagger() decorator in the test itself.
vi.mock('@fastify/swagger', () => ({
  default: async (_app: FastifyInstance, opts: any) => {
    state.swaggerOpts = opts;
  },
}));

vi.mock('@fastify/swagger-ui', () => ({
  default: async (_app: any, opts: any) => {
    state.swaggerUiOpts = opts;
  },
}));

describe('swagger plugin (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.swaggerOpts = null;
    state.swaggerUiOpts = null;
  });

  it('registers swagger & swagger-ui and exposes /openapi.json', async () => {
    const app = Fastify();

    // Manually decorate the root instance before registering the plugin.
    // This ensures `app.swagger()` is available in the route handler's scope.
    app.decorate(
      'swagger',
      vi.fn((_opts?: any) => state.swaggerReturn)
    );

    await app.register(plugin);

    // Assert that the swagger plugins were registered with the correct options
    expect((state.swaggerOpts as any)?.openapi?.info?.title).toBe('Clearcost API');
    expect((state.swaggerOpts as any)?.openapi?.info?.version).toBe('1.0.0');
    expect((state.swaggerOpts as any)?.transform).toBeTruthy();
    expect(state.swaggerUiOpts?.routePrefix).toBe('/docs');

    // Assert that the route works and returns the expected mock data
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(state.swaggerReturn);

    // Assert that our manually-decorated mock function was called by the route handler
    expect(app.swagger).toHaveBeenCalled();

    await app.close();
  });
});
