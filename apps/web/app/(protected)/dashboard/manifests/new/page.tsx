'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type ManifestCsvItem = {
  hs6?: string;
  quantity: number;
  unitValue: { amount: number; currency: string };
};

export default function NewManifestPage() {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState('');
  const [file, setFile] = useState<File | null>(null);

  function parseCsv(text: string): ManifestCsvItem[] {
    const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('CSV is empty');
    }

    // Handle BOM and normalize header
    const headerLine = lines[0]!.replace(/^\uFEFF/, '');
    const cols = headerLine.split(',').map((s) => s.trim().toLowerCase());

    const hsIdx = cols.indexOf('hs6');
    const qtyIdx = cols.indexOf('qty');
    const valIdx = cols.indexOf('unit_value');
    const curIdx = cols.indexOf('currency');

    const missing: string[] = [];
    if (qtyIdx < 0) missing.push('qty');
    if (valIdx < 0) missing.push('unit_value');
    if (curIdx < 0) missing.push('currency');

    if (missing.length) {
      throw new Error(
        `Missing required column(s): ${missing.join(
          ', '
        )}. Expected header to include: hs6 (optional), qty, unit_value, currency`
      );
    }

    const rows = lines.slice(1);

    return rows.map((ln) => {
      const c = ln.split(',').map((s) => s.trim());
      const hs6 = hsIdx >= 0 ? c[hsIdx] || undefined : undefined;

      const qty = Number(c[qtyIdx] ?? '1');
      const amount = Number(c[valIdx] ?? '0');
      const currency = (c[curIdx] || 'USD').toUpperCase();

      return {
        hs6,
        quantity: Number.isFinite(qty) ? qty : 1,
        unitValue: {
          amount: Number.isFinite(amount) ? amount : 0,
          currency,
        },
      };
    });
  }

  async function createFromCsv(f: File) {
    const text = await f.text();
    const items = parseCsv(text);

    setCreating(true);
    setResult('');
    try {
      // Create manifest
      const createRes = await fetch('/api/proxy/manifests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!createRes.ok) {
        throw new Error(`${createRes.status} ${await createRes.text()}`);
      }

      const created = await createRes.json();
      const id: string | undefined = created?.id || created?.manifestId;
      if (!id) throw new Error('Manifest created but id is missing in response');

      // Kick off quote
      const kickRes = await fetch(`/api/proxy/manifests/${encodeURIComponent(id)}/quote`, {
        method: 'POST',
      });

      const kickedText = await kickRes.text();
      setResult(
        `Created manifest ${id}. Quote trigger: ${kickRes.status}.\n\nResponse:\n${kickedText}`
      );
    } catch (e: any) {
      setResult(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  async function onCreateClick() {
    if (!file) {
      setResult('Please choose a CSV file first.');
      return;
    }
    await createFromCsv(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">New manifest</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV and run a bulk quote. Required columns: <code>qty</code>,{' '}
          <code>unit_value</code>, <code>currency</code>. Optional: <code>hs6</code>.
        </p>
      </div>

      <div className="rounded border p-4 flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button disabled={creating} onClick={onCreateClick}>
          {creating ? 'Creating…' : 'Create'}
        </Button>
      </div>

      <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs min-h-[4rem]">
        {result || 'Status will appear here…'}
      </pre>
    </div>
  );
}
