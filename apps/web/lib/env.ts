import 'server-only';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value) return value;

  const isProd = process.env.NODE_ENV === 'production';
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

  if (isProd && !isBuild) {
    throw new Error(`Missing required env: ${name}`);
  }

  console.warn(`Missing required env: ${name}`);
  return '';
}

export function requireEnvStrict(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length ? value : undefined;
}
