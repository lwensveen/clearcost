'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { actionCreateQuote } from '../actions';

export default function NewQuotePage() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<string>('');
  const [form, setForm] = useState({
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
    mode: 'air' as 'air' | 'sea',
  });

  async function run() {
    setLoading(true);
    setResp('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)));
      const res = await actionCreateQuote(fd);
      setResp(JSON.stringify(res.quote, null, 2));
    } catch (e: any) {
      setResp(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">New quote</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estimate landed cost.</p>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              'origin',
              'dest',
              'price',
              'currency',
              'l',
              'w',
              'h',
              'weight',
              'categoryKey',
              'hs6',
            ] as const
          ).map((k) => (
            <label key={k} className="text-sm">
              <span className="mb-1 block text-muted-foreground">{k}</span>
              <input
                className="w-full rounded-md border bg-background p-2"
                value={form[k] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">mode</span>
            <select
              className="w-full rounded-md border bg-background p-2"
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as 'air' | 'sea' }))}
            >
              <option value="air">air</option>
              <option value="sea">sea</option>
            </select>
          </label>
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? 'Calculating…' : 'Estimate'}
        </Button>
        <pre className="mt-3 whitespace-pre-wrap rounded bg-muted p-3 text-xs">
          {resp || 'Response will appear here'}
        </pre>
      </div>
    </div>
  );
}
