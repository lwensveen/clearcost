'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      const body = {
        origin: form.origin,
        dest: form.dest,
        itemValue: { amount: Number(form.price), currency: form.currency },
        dimsCm: { l: Number(form.l), w: Number(form.w), h: Number(form.h) },
        weightKg: Number(form.weight),
        categoryKey: form.categoryKey,
        hs6: form.hs6 || undefined,
        mode: form.mode,
      };

      const r = await fetch('/api/proxy/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      setResp(text);

      // capture in localStorage history
      try {
        const key = r.headers.get('x-cc-idem') || '';
        const entry = {
          ts: Date.now(),
          key,
          status: r.status,
          request: body,
          responseText: text,
        };
        const list = JSON.parse(localStorage.getItem('cc_recent_quotes') || '[]');
        list.unshift(entry);
        localStorage.setItem('cc_recent_quotes', JSON.stringify(list.slice(0, 50)));
      } catch {}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quote input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
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
              ] as const
            ).map(([k, ph]) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block text-muted-foreground">{k}</span>
                <input
                  className="w-full rounded-md border bg-background p-2"
                  value={(form as any)[k] ?? ''}
                  placeholder={ph}
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
        </CardContent>
      </Card>
    </div>
  );
}
