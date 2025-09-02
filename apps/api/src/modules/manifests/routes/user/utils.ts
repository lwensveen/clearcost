import { ManifestItemInsertSchema } from '@clearcost/types/dist/schemas/manifest-items.js';
import { z } from 'zod/v4';

export const ImportQuery = z.object({
  mode: z.enum(['append', 'replace']).default('append'),
  dryRun: z.coerce.boolean().default(false),
});

export type RowShape = z.input<typeof ManifestItemInsertSchema>;

export function parseCsv(text: string): Record<string, string>[] {
  // tiny, robust-enough CSV parser (no streaming). Assumes header row exists.
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0]!.split(',').map((h) =>
    h
      .trim()
      .replace(/^"+|"+$/g, '')
      .toLowerCase()
  );
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    // split by commas, allow quotes with commas inside
    const cells: string[] = [];
    let buf = '';
    let inQ = false;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k]!;
      if (ch === '"') {
        if (inQ && raw[k + 1] === '"') {
          buf += '"';
          k++;
        } else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cells.push(buf);
        buf = '';
      } else {
        buf += ch;
      }
    }
    cells.push(buf);
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) rec[header[c]!] = (cells[c] ?? '').trim();
    out.push(rec);
  }
  return out;
}

export function mapRecordToItem(rec: Record<string, string>, manifestId: string): RowShape {
  // Supported columns (match your exporter): id is ignored; manifestId is derived
  // reference, notes, hs6, categoryKey, itemValueAmount, itemValueCurrency,
  // weightKg, dimsL, dimsW, dimsH, createdAt, updatedAt
  const n = (v?: string) => (v == null || v === '' ? undefined : Number(v));
  const s = (v?: string) => (v == null || v === '' ? undefined : v);

  const dims = {
    l: n(rec['dimsl'] ?? rec['l']) ?? 0,
    w: n(rec['dimsw'] ?? rec['w']) ?? 0,
    h: n(rec['dimsh'] ?? rec['h']) ?? 0,
  };

  const row: any = {
    manifestId,
    reference: s(rec['reference']),
    notes: s(rec['notes']),
    hs6: s(rec['hs6']),
    categoryKey: s(rec['categorykey']),
    itemValueAmount: s(rec['itemvalueamount']) ?? '0',
    itemValueCurrency: s(rec['itemvaluecurrency']) ?? 'USD',
    weightKg: s(rec['weightkg']) ?? '0',
    dimsCm: dims,
  };
  return row;
}
