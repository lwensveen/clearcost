import {
  canonicalInternalBody,
  computeInternalSignature,
  internalBodyHash,
} from '../apps/api/src/lib/internal-signing.ts';

type Args = {
  method: string;
  path: string;
  body?: string;
  validateOnly: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { method: 'POST', path: '', validateOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--method') out.method = String(argv[++i] ?? '').toUpperCase();
    else if (a === '--path') out.path = String(argv[++i] ?? '');
    else if (a === '--body') out.body = String(argv[++i] ?? '');
    else if (a === '--validate') out.validateOnly = true;
  }
  return out;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl =
    process.env.CLEARCOST_INTERNAL_API_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.INTERNAL_API ||
    '';
  const apiKey = process.env.CLEARCOST_TASKS_API_KEY || process.env.TASKS_KEY || '';
  const secret = process.env.INTERNAL_SIGNING_SECRET || '';

  if (args.validateOnly) {
    if (!baseUrl) throw new Error('Missing required env: CLEARCOST_INTERNAL_API_URL');
    if (!apiKey) throw new Error('Missing required env: CLEARCOST_TASKS_API_KEY');
    if (!secret) throw new Error('Missing required env: INTERNAL_SIGNING_SECRET');
    console.log('internal-request: env ok');
    return;
  }

  if (!args.path) throw new Error('Missing required arg: --path');
  if (!baseUrl) throw new Error('Missing required env: CLEARCOST_INTERNAL_API_URL');
  if (!apiKey) throw new Error('Missing required env: CLEARCOST_TASKS_API_KEY');
  if (!secret) throw new Error('Missing required env: INTERNAL_SIGNING_SECRET');

  const method = args.method.toUpperCase();
  const bodyStr =
    method === 'GET' || method === 'HEAD' ? '{}' : canonicalInternalBody(args.body ?? '{}');
  const ts = String(Date.now());
  const bodyHash = internalBodyHash(bodyStr);
  const sig = computeInternalSignature({
    ts,
    method,
    path: args.path,
    bodyHash,
    secret,
  });

  const url = `${baseUrl.replace(/\/+$/, '')}${args.path}`;
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'x-cc-ts': ts,
    'x-cc-sig': sig,
  };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['content-type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : bodyStr,
  });

  const text = await res.text();
  if (!res.ok) {
    const msg = `internal-request: ${res.status} ${res.statusText}`;
    console.error(msg);
    if (text) console.error(text);
    process.exit(1);
  }

  if (text) process.stdout.write(text);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
