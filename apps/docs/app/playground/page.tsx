'use client';

import { useState } from 'react';
import { formatError } from '../../../web/lib/errors';

type FormState = {
  origin: string;
  dest: string;
  price: string;
  currency: string;
  l: string;
  w: string;
  h: string;
  weight: string;
  categoryKey: string;
  hs6: string;
  mode: 'air' | 'sea';
};

export default function Playground() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<string>('');
  const [form, setForm] = useState<FormState>({
    origin: 'US',
    dest: 'DE',
    price: '120',
    currency: 'USD',
    l: '20',
    w: '15',
    h: '10',
    weight: '1.2',
    categoryKey: 'general',
    hs6: '',
    mode: 'air',
  });

  const fields = [
    ['origin', 'US'],
    ['dest', 'DE'],
    ['price', '120'],
    ['currency', 'USD'],
    ['l', '20'],
    ['w', '15'],
    ['h', '10'],
    ['weight', '1.2'],
    ['categoryKey', 'general'],
    ['hs6', ''],
    ['mode', 'air'],
  ] as const satisfies ReadonlyArray<readonly [keyof FormState, string]>;

  async function run() {
    setLoading(true);
    setResp('');
    try {
      const r = await fetch('/api/try/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origin: form.origin,
          dest: form.dest,
          itemValue: { amount: Number(form.price), currency: form.currency },
          dimsCm: { l: Number(form.l), w: Number(form.w), h: Number(form.h) },
          weightKg: Number(form.weight),
          categoryKey: form.categoryKey,
          hs6: form.hs6 || undefined,
          mode: form.mode,
        }),
      });
      const t = await r.text();
      setResp(t);
    } catch (e: unknown) {
      setResp(formatError(e, 'Request failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Try the Quote API</h1>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, ph]) => (
          <label key={k as string} className="text-sm">
            <span className="block text-gray-600 mb-1">{k}</span>
            <input
              className="w-full rounded border px-2 py-1"
              value={form[k] as string}
              placeholder={ph}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              list={k === 'mode' ? 'mode-list' : undefined}
            />
          </label>
        ))}
        <datalist id="mode-list">
          <option value="air" />
          <option value="sea" />
        </datalist>
      </div>
      <button
        onClick={run}
        disabled={loading}
        className="mt-4 rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Calculating…' : 'Call API'}
      </button>
      <pre className="mt-4 whitespace-pre-wrap bg-gray-50 rounded p-3 text-sm">
        {resp || 'Response will appear here'}
      </pre>
      <p className="mt-2 text-xs text-gray-500">
        This page calls a server-side proxy in this docs app. No secret keys are exposed in the
        browser.
      </p>
    </main>
  );
}
