import { NextResponse } from 'next/server';
import { importSurcharges } from '@/lib/surcharges';
import { errorJson } from '@/lib/http';

type SurchargeImportRow = {
  dest: string;
  surchargeCode: string;
  fixedAmt?: number | null;
  pctAmt?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0]!.split(',').map((h) => h.trim());

  return lines.slice(1).map((l, idx) => {
    const cells = l.split(',').map((c) => c.trim());
    const row: Record<string, string | number | null | undefined> = {};

    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    row.fixedAmt = row.fixedAmt ? Number(row.fixedAmt) : undefined;
    row.pctAmt = row.pctAmt ? Number(row.pctAmt) : undefined;
    row.effectiveFrom = row.effectiveFrom || new Date().toISOString().slice(0, 10);
    row.effectiveTo = row.effectiveTo || null;
    row.notes = row.notes || null;

    const out: SurchargeImportRow = {
      dest: String(row.dest ?? '').trim(),
      surchargeCode: String(row.code ?? '').trim(),
      fixedAmt: row.fixedAmt == null ? undefined : Number(row.fixedAmt),
      pctAmt: row.pctAmt == null ? undefined : Number(row.pctAmt),
      effectiveFrom: String(row.effectiveFrom ?? '').trim(),
      effectiveTo: row.effectiveTo == null ? null : String(row.effectiveTo),
      notes: row.notes == null ? null : String(row.notes),
    };

    if (!out.dest || !out.surchargeCode || !out.effectiveFrom) {
      throw new Error(`Row ${idx + 2}: dest, code, effectiveFrom are required`);
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

    await importSurcharges(rows);

    return NextResponse.redirect(new URL('/admin/surcharges', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'import failed', 500);
  }
}
