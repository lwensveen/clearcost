import 'fastify';

export type ImportMeta = { source: string; job: string; dest?: string };

export type ImportCtx = {
  meta: ImportMeta;
  runId: string;
  endTimer: () => void;
};

declare module 'fastify' {
  interface FastifyContextConfig {
    importMeta?: ImportMeta;
  }

  interface FastifyRequest {
    importCtx?: ImportCtx;
  }
}
