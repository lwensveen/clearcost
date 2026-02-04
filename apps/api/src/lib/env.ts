type ApiRuntimeEnv = {
  nodeEnv: string;
  publicHost: string;
  publicPort: number;
  internalHost: string;
  internalPort: number;
  allowInternalBind: boolean;
  metricsRequireSigning: boolean;
  trustProxy: string;
};

function parsePort(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid ${name}: expected integer port (1-65535), got "${raw}"`);
  }
  return parsed;
}

export function validateApiRuntimeEnv(): ApiRuntimeEnv {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim();
  const missing: string[] = [];

  if (!(process.env.DATABASE_URL ?? '').trim()) missing.push('DATABASE_URL');
  if (nodeEnv === 'production' && !(process.env.API_KEY_PEPPER ?? '').trim()) {
    missing.push('API_KEY_PEPPER');
  }
  if (nodeEnv === 'production' && !(process.env.INTERNAL_SIGNING_SECRET ?? '').trim()) {
    missing.push('INTERNAL_SIGNING_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required API env vars: ${missing.join(', ')}`);
  }

  const metricsRequireSigningRaw = (process.env.METRICS_REQUIRE_SIGNING ?? '').trim();
  const metricsRequireSigning =
    nodeEnv === 'production' ? metricsRequireSigningRaw !== '0' : metricsRequireSigningRaw === '1';

  return {
    nodeEnv,
    publicHost: (process.env.HOST ?? '0.0.0.0').trim() || '0.0.0.0',
    publicPort: parsePort('PORT', 3001),
    internalHost: (process.env.INTERNAL_HOST ?? '0.0.0.0').trim() || '0.0.0.0',
    internalPort: parsePort('INTERNAL_PORT', 3002),
    allowInternalBind: process.env.ALLOW_INTERNAL_BIND === '1',
    metricsRequireSigning,
    trustProxy: (process.env.TRUST_PROXY ?? '').trim(),
  };
}
