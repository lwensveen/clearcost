import { NextResponse } from 'next/server';
import { importVAT } from '@/lib/vat';

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0]!.split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: any = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    row.ratePct = Number(row.ratePct || 0);
    row.effectiveFrom = row.effectiveFrom || new Date().toISOString().slice(0, 10);
    row.effectiveTo = row.effectiveTo || null;

    if (row.base !== 'CIF' && row.base !== 'CIF_PLUS_DUTY') row.base = 'CIF_PLUS_DUTY';

    return row;
  });
}

export async function POST(req: Request) {
  const fd = await req.formData();
  const csv = String(fd.get('csv') ?? '');

  try {
    const rows = parseCsv(csv);

    if (!rows.length) return NextResponse.json({ error: 'No rows' }, { status: 400 });

    await importVAT(rows);

    return NextResponse.redirect(new URL('/admin/vat', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'import failed' }, { status: 500 });
  }
}
