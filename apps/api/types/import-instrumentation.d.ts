import 'fastify';
import type { ImportSource } from '../src/lib/provenance.js';

export type ImportMeta = {
  importSource: ImportSource;
  job: string;
  sourceKey?: string;
  source?: string;
  sourceUrl?: string;
  version?: string;
};

export type ImportRunPatch = {
  sourceKey?: string;
  sourceUrl?: string;
  version?: string;
  fileHash?: string | null;
  fileBytes?: number | null;
};

export type ImportCtx = {
  meta: ImportMeta;
  runId: string;
  endTimer: () => void;
  lockKey?: string;
  runPatch?: ImportRunPatch;
};

type UsageBag = { start: number; bytesIn: number; bytesOut: number };

declare module 'fastify' {
  interface FastifyContextConfig {
    importMeta?: ImportMeta;
    /** Optional override; defaults to `${source}:${job}` */
    importLockKey?: string | ((req: FastifyRequest) => string);
  }

  interface FastifyRouteConfig {
    importMeta?: ImportMeta;
    importLockKey?: string | ((req: FastifyRequest) => string);
  }

  interface FastifyRequest {
    /** Prom-client histogram timer end() placed by the metrics plugin */
    _prom_end?: (labels?: Record<string, string>) => void;
    /** Heartbeat timer held by the import-instrumentation plugin */
    _importHeartbeat?: NodeJS.Timeout;
    // Simple usage/metering bag (set by usage plugin)
    _usage?: UsageBag;
    importCtx?: ImportCtx;
    // your API key augmentation (already present in your repo):
    apiKey?: { id: string; ownerId: string; scopes: string[] };
  }

  interface FastifyInstance {
    requireApiKey: (
      scopes?: string[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    importsSwept?: import('prom-client').Counter;
  }
}
