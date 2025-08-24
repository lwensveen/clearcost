import { NextResponse } from 'next/server';
import { importSurcharges } from '@/lib/surcharges';

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0]!.split(',').map((h) => h.trim());

  return lines.slice(1).map((l) => {
    const cells = l.split(',').map((c) => c.trim());
    const row: any = {};

    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    row.fixedAmt = row.fixedAmt ? Number(row.fixedAmt) : undefined;
    row.pctAmt = row.pctAmt ? Number(row.pctAmt) : undefined;
    row.effectiveFrom = row.effectiveFrom || new Date().toISOString().slice(0, 10);
    row.effectiveTo = row.effectiveTo || null;
    row.notes = row.notes || null;

    return row;
  });
}

export async function POST(req: Request) {
  const fd = await req.formData();
  const csv = String(fd.get('csv') ?? '');

  try {
    const rows = parseCsv(csv);

    if (!rows.length) return NextResponse.json({ error: 'No rows' }, { status: 400 });

    await importSurcharges(rows);

    return NextResponse.redirect(new URL('/admin/surcharges', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'import failed' }, { status: 500 });
  }
}
