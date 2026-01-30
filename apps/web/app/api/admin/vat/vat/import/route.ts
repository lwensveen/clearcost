import { NextResponse } from 'next/server';
import { importVAT } from '@/lib/vat';
import { errorJson } from '@/lib/http';

type VatImportRow = {
  dest: string;
  ratePct: number;
  vatBase: 'CIF' | 'CIF_PLUS_DUTY';
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0]!.split(',').map((h) => h.trim());

  return lines.slice(1).map((line, idx) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string | number | null | undefined> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    row.ratePct = Number(row.ratePct || 0);
    row.effectiveFrom = row.effectiveFrom || new Date().toISOString().slice(0, 10);
    row.effectiveTo = row.effectiveTo || null;

    if (row.base !== 'CIF' && row.base !== 'CIF_PLUS_DUTY') row.base = 'CIF_PLUS_DUTY';

    const out: VatImportRow = {
      dest: String(row.dest ?? '').trim(),
      ratePct: Number(row.ratePct ?? 0),
      vatBase: row.base as 'CIF' | 'CIF_PLUS_DUTY',
      effectiveFrom: String(row.effectiveFrom ?? '').trim(),
      effectiveTo: row.effectiveTo == null ? null : String(row.effectiveTo),
      notes: row.notes == null ? null : String(row.notes),
    };

    if (!out.dest || !out.effectiveFrom || !Number.isFinite(out.ratePct)) {
      throw new Error(`Row ${idx + 2}: dest, ratePct, effectiveFrom are required`);
    }

    return out;
  });
}

export async function POST(req: Request) {
  const fd = await req.formData();
  const csv = String(fd.get('csv') ?? '');

  try {
    const rows = parseCsv(csv);

    if (!rows.length) return errorJson('No rows', 400);

    await importVAT(rows);

    return NextResponse.redirect(new URL('/admin/vat', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'import failed', 500);
  }
}
