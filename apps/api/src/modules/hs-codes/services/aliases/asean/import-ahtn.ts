// Import AHTN8 aliases into hs_code_aliases (system='AHTN8') with optional provenance.
//
// Input CSV columns (any of these variants):
//   - code: ahtn | ahtn8 | code | code8 | cn_code   (8-digit)
//   - title: title | description | desc | text
//
// Upserts (system, code) -> { hs6, title, chapter, heading4 } and, if importId is provided,
// records provenance rows (resourceType='hs_code_alias') for each upserted alias.

import { db, hsCodeAliasesTable, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { sha256Hex } from '../../../../../lib/provenance.js';

function hs6(code8: string): string | null {
  const s = (code8 ?? '').replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
}
function norm8(code8: string): string | null {
  const s = (code8 ?? '').replace(/\D+/g, '').slice(0, 8);
  return s.length === 8 ? s : null;
}
const hs2n = (code: string) => parseInt(code.slice(0, 2), 10);
const hs4 = (code: string) => code.slice(0, 4);

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} ${r.statusText}`);
  return r.text();
}

// tiny CSV parser (quoted fields + commas in quotes)
function parseCsv(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const trimmed = text.replace(/^\uFEFF/, ''); // strip BOM if present
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"'; // escaped quote
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  if (lines.length === 0) return rows;

  const header = parseLine(lines[0]!).map((h) => h.toLowerCase());
  const idx = (aliases: string[]) => {
    const lowered = aliases.map((a) => a.toLowerCase());
    for (let i = 0; i < header.length; i++) {
      if (lowered.includes(header[i]!)) return i;
    }
    return -1;
  };

  const colCode = idx(['ahtn', 'ahtn8', 'code', 'code8', 'cn_code']);
  const colTitle = idx(['title', 'description', 'desc', 'text']);

  if (colCode < 0 || colTitle < 0) return rows;

  for (let r = 1; r < lines.length; r++) {
    const cells = parseLine(lines[r]!);
    const code8 = cells[colCode] ?? '';
    const title = (cells[colTitle] ?? '').replace(/\s+/g, ' ').trim();
    if (!code8 || !title) continue;

    const c8 = norm8(code8);
    const c6 = c8 ? hs6(c8) : null;
    if (!c8 || !c6) continue;

    rows.push({ code8: c8, hs6: c6, title });
  }
  return rows;
}

export type ImportAhtnResult = { ok: true; count: number; message?: string };

type ImportAhtnOpts = {
  url?: string; // CSV URL; default: process.env.AHTN_CSV_URL
  batchSize?: number; // default 2000
  importId?: string; // provenance run id (optional)
  makeSourceRef?: (code8: string) => string | undefined; // optional provenance source ref builder
};

export async function importAhtnAliases(opts: ImportAhtnOpts = {}): Promise<ImportAhtnResult> {
  const url = opts.url ?? process.env.AHTN_CSV_URL ?? '';
  if (!url) return { ok: true as const, count: 0, message: 'AHTN_CSV_URL not set' };

  const text = await fetchText(url);
  const rows = parseCsv(text) as Array<{ code8: string; hs6: string; title: string }>;
  if (!rows.length) return { ok: true as const, count: 0 };

  const batchSize = Math.max(1, opts.batchSize ?? 2000);
  let inserted = 0;

  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);

      // Collect provenance rows for this chunk to write once
      const prov: {
        importId: string;
        resourceType: 'hs_code_alias';
        resourceId: string;
        sourceRef?: string;
        rowHash: string;
      }[] = [];

      for (const r of chunk) {
        const ret = await trx
          .insert(hsCodeAliasesTable)
          .values({
            system: 'AHTN8',
            code: r.code8,
            hs6: r.hs6,
            title: r.title,
            chapter: hs2n(r.code8),
            heading4: hs4(r.code8),
          })
          .onConflictDoUpdate({
            target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
            set: {
              hs6: r.hs6,
              title: r.title,
              chapter: hs2n(r.code8),
              heading4: hs4(r.code8),
              updatedAt: sql`now()`,
            },
          })
          .returning({
            id: hsCodeAliasesTable.id,
            code: hsCodeAliasesTable.code,
            hs6: hsCodeAliasesTable.hs6,
            title: hsCodeAliasesTable.title,
          });

        const row = ret[0];
        if (row && opts.importId) {
          prov.push({
            importId: opts.importId,
            resourceType: 'hs_code_alias',
            resourceId: row.id,
            sourceRef: opts.makeSourceRef?.(row.code) ?? `ahtn8:${row.code}`,
            rowHash: sha256Hex(
              JSON.stringify({
                system: 'AHTN8',
                code: row.code,
                hs6: row.hs6,
                title: row.title,
              })
            ),
          });
        }
      }

      if (prov.length) {
        await trx.insert(provenanceTable).values(prov);
      }

      inserted += chunk.length;
    }
  });

  return { ok: true as const, count: inserted };
}
