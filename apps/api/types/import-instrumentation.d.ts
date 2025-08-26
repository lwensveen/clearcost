import 'fastify';

import type { ImportSource } from '../src/lib/provenance.js';

export type ImportMeta = { source: ImportSource; job: string };

export type ImportCtx = {
  meta: ImportMeta;
  runId: string;
  endTimer: () => void;
  lockKey?: string;
};

type UsageBag = { start: number; bytesIn: number; bytesOut: number };

declare module 'fastify' {
  interface FastifyContextConfig {
    importMeta?: ImportMeta;
  }

  interface FastifyRouteConfig {
    importMeta?: ImportMeta;
  }

  interface FastifyRequest {
    // From your API key auth plugin
    apiKey?: {
      id: string;
      ownerId: string;
      scopes: string[];
    };
    // Prometheus HTTP timing helper (set by metrics plugin)
    _prom_end?: (labels?: Record<string, string>) => void;
    // Simple usage/metering bag (set by usage plugin)
    _usage?: UsageBag;
    // Import instrumentation context (set by import-instrumentation plugin)
    importCtx?: ImportCtx;
    // Heartbeat interval held by the import plugin
    _importHeartbeat?: NodeJS.Timeout;
  }

  /**
   * Helper your auth plugin decorates on the app instance
   * to enforce scoped API key access in routes.
   */
  interface FastifyInstance {
    requireApiKey: (
      scopes?: string[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    importsSwept?: import('prom-client').Counter;
  }
}
