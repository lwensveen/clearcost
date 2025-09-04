'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type ManifestCsvItem = {
  hs6?: string;
  quantity: number;
  unitValue: { amount: number; currency: string };
};

function parseCsv(text: string): ManifestCsvItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter((ln) => ln.length > 0);

  if (lines.length === 0) {
    throw new Error('CSV is empty');
  }

  const headerLine = (lines[0] ?? '').replace(/^\uFEFF/, '');
  if (!headerLine) throw new Error('CSV is missing a header row');

  const cols = headerLine.split(',').map((s) => s.trim().toLowerCase());

  const hsIdx = cols.indexOf('hs6'); // optional
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

  const dataLines = lines.slice(1);

  return dataLines.map((ln, i) => {
    const c = ln.split(',').map((s) => s.trim());

    const hs6 = hsIdx >= 0 ? c[hsIdx] || undefined : undefined;

    const qtyRaw = c[qtyIdx] ?? '1';
    const amountRaw = c[valIdx] ?? '0';
    const currencyRaw = c[curIdx] ?? 'USD';

    const qty = Number(qtyRaw);
    const amount = Number(amountRaw);
    const currency = String(currencyRaw).toUpperCase();

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Row ${i + 2}: qty must be a positive number`);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Row ${i + 2}: unit_value must be a number ≥ 0`);
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error(`Row ${i + 2}: currency must be a 3-letter code`);
    }
    if (hs6 && !/^\d{6}$/.test(hs6)) {
      throw new Error(`Row ${i + 2}: hs6 must be 6 digits if provided`);
    }

    return {
      hs6,
      quantity: qty,
      unitValue: { amount, currency },
    };
  });
}

export default function NewManifestPage() {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ManifestCsvItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(f: File | null) {
    setFile(f);
    setPreview(null);
    setError(null);
    setResult('');

    if (!f) return;

    try {
      const text = await f.text();
      const items = parseCsv(text);
      setPreview(items.slice(0, 5));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  const canCreate = useMemo(() => !!file && !error, [file, error]);

  async function handleCreate() {
    if (!file) {
      setResult('Please choose a CSV file first.');
      return;
    }
    if (error) {
      setResult(`Fix CSV errors first: ${error}`);
      return;
    }

    setCreating(true);
    setResult('');

    try {
      const text = await file.text();
      const items = parseCsv(text);

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

      const computeRes = await fetch(`/api/proxy/manifests/${encodeURIComponent(id)}/compute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ allocation: 'chargeable', dryRun: false }),
      });

      const computeText = await computeRes.text();

      setResult(
        [
          `Created manifest ${id}.`,
          `Compute trigger: ${computeRes.status}.`,
          `\nResponse:\n${computeText}`,
          `\nOpen: /dashboard/manifests/${id}`,
        ].join(' ')
      );
    } catch (e: any) {
      setResult(e?.message || String(e));
    } finally {
      setCreating(false);
    }
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

      <div className="rounded border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          />
          <Button disabled={creating || !canCreate} onClick={handleCreate}>
            {creating ? 'Creating…' : 'Create & Compute'}
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-600">
            <strong>CSV error:</strong> {error}
          </div>
        )}

        {preview && preview.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Previewing first {preview.length} row{preview.length > 1 ? 's' : ''}:
            <pre className="mt-2 whitespace-pre rounded bg-muted p-3">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <pre className="min-h-[4rem] whitespace-pre-wrap rounded bg-muted p-3 text-xs">
        {result || 'Status will appear here…'}
      </pre>
    </div>
  );
}
