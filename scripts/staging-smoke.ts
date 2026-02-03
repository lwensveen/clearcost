import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  computeInternalSignature,
  internalBodyHash,
} from '../apps/api/src/lib/internal-signing.ts';

type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  expected?: string;
  detail?: string;
  durationMs: number;
};

type JsonObject = Record<string, unknown>;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function toBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function request(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ status: number; text: string; json: unknown | null }> {
  const timeoutMs = init.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let json: unknown | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as JsonObject;
}

async function main() {
  const publicApi = toBaseUrl(requireEnv('STAGING_PUBLIC_API_URL'));
  const internalApi = toBaseUrl(requireEnv('STAGING_INTERNAL_API_URL'));
  const publicKey = requireEnv('STAGING_PUBLIC_API_KEY');
  const opsKey = requireEnv('STAGING_OPS_API_KEY');
  const billingKey = process.env.STAGING_BILLING_API_KEY?.trim() || publicKey;
  const billingWriteKey = process.env.STAGING_BILLING_WRITE_API_KEY?.trim() || billingKey;
  const internalSigningSecret = process.env.STAGING_INTERNAL_SIGNING_SECRET?.trim() || '';
  const reportPath = process.env.STAGING_SMOKE_REPORT_PATH || 'artifacts/staging-smoke-report.json';

  const results: CheckResult[] = [];

  async function check(name: string, fn: () => Promise<Omit<CheckResult, 'name' | 'durationMs'>>) {
    const start = Date.now();
    try {
      const out = await fn();
      results.push({ name, durationMs: Date.now() - start, ...out });
    } catch (error) {
      results.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      });
    }
  }

  await check('public quote computes', async () => {
    const payload = {
      origin: 'US',
      dest: 'GB',
      itemValue: { amount: 120, currency: 'USD' },
      dimsCm: { l: 15, w: 10, h: 8 },
      weightKg: 1.2,
      categoryKey: 'smoke',
      hs6: '847130',
      mode: 'air',
    };
    const r = await request(`${publicApi}/v1/quotes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `smoke-${randomUUID()}`,
        'x-api-key': publicKey,
      },
      body: JSON.stringify(payload),
    });
    if (r.status !== 200) {
      return {
        ok: false,
        status: r.status,
        expected: '200',
        detail: r.text.slice(0, 300),
      };
    }
    const body = asObject(r.json);
    const total = body?.total;
    if (typeof total !== 'number') {
      return {
        ok: false,
        status: r.status,
        expected: 'quote response with numeric total',
        detail: JSON.stringify(body),
      };
    }
    return { ok: true, status: r.status };
  });

  await check('billing plan', async () => {
    const r = await request(`${publicApi}/v1/billing/plan`, {
      headers: { 'x-api-key': billingKey },
    });
    const body = asObject(r.json);
    if (r.status !== 200) {
      return { ok: false, status: r.status, expected: '200', detail: r.text.slice(0, 300) };
    }
    if (typeof body?.plan !== 'string') {
      return {
        ok: false,
        status: r.status,
        expected: 'response.plan string',
        detail: JSON.stringify(body),
      };
    }
    return { ok: true, status: r.status };
  });

  await check('billing entitlements', async () => {
    const r = await request(`${publicApi}/v1/billing/entitlements`, {
      headers: { 'x-api-key': billingKey },
    });
    if (r.status !== 200) {
      return { ok: false, status: r.status, expected: '200', detail: r.text.slice(0, 300) };
    }
    return { ok: true, status: r.status };
  });

  await check('billing compute usage', async () => {
    const r = await request(`${publicApi}/v1/billing/compute-usage`, {
      headers: { 'x-api-key': billingKey },
    });
    if (r.status !== 200) {
      return { ok: false, status: r.status, expected: '200', detail: r.text.slice(0, 300) };
    }
    return { ok: true, status: r.status };
  });

  await check('billing checkout session', async () => {
    const r = await request(`${publicApi}/v1/billing/checkout`, {
      method: 'POST',
      headers: {
        'x-api-key': billingWriteKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        plan: 'starter',
        returnUrl: `${publicApi}/admin/billing?smoke=1`,
      }),
    });
    if (r.status !== 200) {
      return {
        ok: false,
        status: r.status,
        expected: '200',
        detail: r.text.slice(0, 300),
      };
    }

    const body = asObject(r.json);
    if (typeof body?.url !== 'string' || body.url.length < 10) {
      return {
        ok: false,
        status: r.status,
        expected: 'response.url string',
        detail: JSON.stringify(body),
      };
    }

    return { ok: true, status: r.status };
  });

  await check('internal healthz', async () => {
    const r = await request(`${internalApi}/internal/healthz`);
    if (r.status !== 200) {
      return { ok: false, status: r.status, expected: '200', detail: r.text.slice(0, 300) };
    }
    const body = asObject(r.json);
    if (body?.ok !== true) {
      return {
        ok: false,
        status: r.status,
        expected: 'response.ok === true',
        detail: JSON.stringify(body),
      };
    }
    return { ok: true, status: r.status };
  });

  await check('metrics rejects anonymous', async () => {
    const r = await request(`${internalApi}/metrics`);
    if (r.status !== 401 && r.status !== 403) {
      return {
        ok: false,
        status: r.status,
        expected: '401 or 403',
        detail: r.text.slice(0, 300),
      };
    }
    return { ok: true, status: r.status };
  });

  await check('metrics accepts ops key (signed when required)', async () => {
    const unsigned = await request(`${internalApi}/metrics`, {
      headers: { 'x-api-key': opsKey },
    });

    if (unsigned.status === 200) {
      if (!unsigned.text.includes('# HELP')) {
        return {
          ok: false,
          status: unsigned.status,
          expected: 'prometheus metrics body',
          detail: unsigned.text.slice(0, 300),
        };
      }
      return { ok: true, status: unsigned.status };
    }

    if (unsigned.status !== 401 && unsigned.status !== 403) {
      return {
        ok: false,
        status: unsigned.status,
        expected: '200, 401, or 403',
        detail: unsigned.text.slice(0, 300),
      };
    }

    if (!internalSigningSecret) {
      return {
        ok: false,
        status: unsigned.status,
        expected: 'STAGING_INTERNAL_SIGNING_SECRET for signed metrics',
        detail: 'Metrics likely requires internal signing.',
      };
    }

    const path = '/metrics';
    const method = 'GET';
    const ts = String(Date.now());
    const bodyHash = internalBodyHash('{}');
    const sig = computeInternalSignature({
      ts,
      method,
      path,
      bodyHash,
      secret: internalSigningSecret,
    });
    const signed = await request(`${internalApi}${path}`, {
      method,
      headers: {
        'x-api-key': opsKey,
        'x-cc-ts': ts,
        'x-cc-sig': sig,
      },
    });
    if (signed.status !== 200) {
      return {
        ok: false,
        status: signed.status,
        expected: '200',
        detail: signed.text.slice(0, 300),
      };
    }
    if (!signed.text.includes('# HELP')) {
      return {
        ok: false,
        status: signed.status,
        expected: 'prometheus metrics body',
        detail: signed.text.slice(0, 300),
      };
    }
    return { ok: true, status: signed.status };
  });

  const ok = results.every((r) => r.ok);
  const report = {
    ok,
    checkedAt: new Date().toISOString(),
    publicApi,
    internalApi,
    results,
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error('Staging smoke failed:');
    for (const failure of failures) {
      console.error(
        `- ${failure.name}: status=${failure.status ?? 'n/a'} expected=${failure.expected ?? 'n/a'} detail=${failure.detail ?? 'n/a'}`
      );
    }
    process.exit(1);
  }

  console.log(`Staging smoke passed (${results.length} checks).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
