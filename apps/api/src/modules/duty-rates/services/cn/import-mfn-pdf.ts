import { readFile } from 'node:fs/promises';
import { parse as csvParse } from 'csv-parse/sync';
import type { DutyRateInsert } from '@clearcost/types';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { tabulaCsv } from '../../utils/pdf-tabula.js';
import { pickHeader, toHs6 } from '../../utils/parse.js';
import { db, hsCodeAliasesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import {
  type DutyComponentInput,
  type ParentKey,
  upsertComponentsForParents,
} from '../../utils/components.js';

// -----------------------------
// Options
// -----------------------------
export type CnColumnHint = 'mfn' | 'general' | 'provisional';

type ImportOptions = {
  urlOrPath: string; // http(s) | file:// | local path
  pages?: string; // Tabula page filter, e.g. "1-3,7"
  mode?: 'auto' | 'lattice' | 'stream';
  columnHint?: CnColumnHint; // force a particular rate column (MFN preferred)
  importId?: string;
  batchSize?: number;
  dryRun?: boolean;
  effectiveFrom?: Date | null; // tag parents/components with pub date if you have it
  effectiveTo?: Date | null;
  writeAliases?: boolean; // also store CN8 alias rows (title + code)
};

// -----------------------------
// Header detection
// -----------------------------
const HS_ALIASES = ['HS', 'HS CODE', 'CODE', 'SUBHEADING', 'HEADING', 'TARIFF CODE', '税则号列'];
const DESC_ALIASES = ['DESCRIPTION', '品名', '商品名称', 'GOODS', '品名及规格', '名称'];
const MFN_ALIASES = ['MFN', '最惠国', '最惠国税率'];
const GENERAL_ALIASES = ['GENERAL', '普通税率', '一般税率'];
const PROVISIONAL_ALIASES = ['PROVISIONAL', '暂定税率'];
const FALLBACK_RATE_ALIASES = [
  'BASIC DUTY',
  'DUTY',
  'AD VALOREM',
  'RATE',
  'TARIFF (%)',
  'TARIFF RATE',
  '进口关税',
];

function pickRateHeader(headers: string[], hint?: CnColumnHint): string | null {
  if (hint === 'mfn') return pickHeader(headers, MFN_ALIASES);
  if (hint === 'general') return pickHeader(headers, GENERAL_ALIASES);
  if (hint === 'provisional') return pickHeader(headers, PROVISIONAL_ALIASES);

  // Priority order if no hint: MFN → General → Provisional → fallback list
  return (
    pickHeader(headers, MFN_ALIASES) ||
    pickHeader(headers, GENERAL_ALIASES) ||
    pickHeader(headers, PROVISIONAL_ALIASES) ||
    pickHeader(headers, FALLBACK_RATE_ALIASES)
  );
}

// -----------------------------
// CN rate cell → components
// - Extract ad-valorem %, specific components, min/max, and detect "whichever" operator.
// -----------------------------
type ParsedCnRate = {
  advalPct: number | null;
  specifics: Array<{ amount: number; currency: string; uom: string }>;
  minimum?: { amount: number; currency: string; uom: string };
  maximum?: { amount: number; currency: string; uom: string };
  combineOp?: 'max_of' | 'min_of'; // 孰高/孰低（whichever is higher/lower）
  leftover?: string;
};

function normalizeUom(raw: string | undefined): string {
  const text = (raw ?? '').trim().toLowerCase();
  if (!text) return 'unit';
  if (['kg', '千克', '公斤'].some((x) => text.includes(x))) return 'kg';
  if (['g', '克'].some((x) => text.includes(x))) return 'g';
  if (['t', '吨'].some((x) => text.includes(x))) return 't';
  if (['m3', '立方米'].some((x) => text.includes(x))) return 'm3';
  if (['m2', '平方米'].some((x) => text.includes(x))) return 'm2';
  if (['l', '升'].some((x) => text === x || text.endsWith(x))) return 'l';
  if (['m', '米'].some((x) => text === x || text.endsWith(x))) return 'm';
  if (['件', 'piece', 'pcs'].some((x) => text.includes(x))) return 'piece';
  if (['套', 'set'].some((x) => text.includes(x))) return 'set';
  if (['双', 'pair'].some((x) => text.includes(x))) return 'pair';
  return text;
}

function normalizeCurrency(raw?: string | null): string {
  const text = (raw ?? '').trim().toUpperCase();
  if (!text) return 'CNY';
  if (/(RMB|CNY|人民币|元|￥|¥)/.test(text)) return 'CNY';
  if (/(USD|\$)/.test(text)) return 'USD';
  return 'CNY';
}

function parseCnRateComponents(cellText: string): ParsedCnRate {
  const text = (cellText ?? '').replace(/，/g, ',').replace(/％/g, '%').replace(/\s+/g, ' ').trim();

  const result: ParsedCnRate = { advalPct: null, specifics: [] };
  if (!text) return result;

  // ad-valorem
  const advalMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (advalMatch?.[1]) result.advalPct = Number(advalMatch[1]);
  else if (/^(free|免税)$/i.test(text)) result.advalPct = 0;

  // specific components
  const specificRegex =
    /(?:人民币|RMB|CNY|￥|¥)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元|人民币|RMB|CNY|￥|¥)?\s*(?:\/|每|per)\s*([A-Za-z\u4e00-\u9fa5\d]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = specificRegex.exec(text)) !== null) {
    const amount = Number(m[1]);
    const uomRaw = m[2];
    if (!Number.isFinite(amount)) continue;
    result.specifics.push({ amount, currency: 'CNY', uom: normalizeUom(uomRaw) });
  }

  // min / max
  const minRegex =
    /(最低|不低于|不少于|not\s+less\s+than|min(?:imum)?)\s*(?:人民币|RMB|CNY|￥|¥)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元|人民币|RMB|CNY|￥|¥)?\s*(?:\/|每|per)\s*([A-Za-z\u4e00-\u9fa5\d]+)/i;
  const maxRegex =
    /(最高|不高于|不超过|not\s+more\s+than|max(?:imum)?)\s*(?:人民币|RMB|CNY|￥|¥)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元|人民币|RMB|CNY|￥|¥)?\s*(?:\/|每|per)\s*([A-Za-z\u4e00-\u9fa5\d]+)/i;

  const minMatch = text.match(minRegex);
  if (minMatch?.[2] && minMatch[3]) {
    result.minimum = {
      amount: Number(minMatch[2]),
      currency: 'CNY',
      uom: normalizeUom(minMatch[3]),
    };
  }
  const maxMatch = text.match(maxRegex);
  if (maxMatch?.[2] && maxMatch[3]) {
    result.maximum = {
      amount: Number(maxMatch[2]),
      currency: 'CNY',
      uom: normalizeUom(maxMatch[3]),
    };
  }

  // "whichever is higher/lower"
  if (/孰高|whichever\s+is\s+higher/i.test(text)) result.combineOp = 'max_of';
  if (/孰低|whichever\s+is\s+lower/i.test(text)) result.combineOp = 'min_of';

  result.leftover = text;
  return result;
}

function toCn8(codeText: string | undefined): string | null {
  const digits = String(codeText ?? '').replace(/\D+/g, '');
  if (digits.length < 8) return null;
  return digits.slice(0, 8);
}

function titleFromDescription(desc: string | undefined): string {
  const t = String(desc ?? '').trim();
  return t || '—';
}

export async function importCnMfnFromPdf(options: ImportOptions) {
  // 1) Buffer
  const isUrl = /^https?:\/\//i.test(options.urlOrPath) || options.urlOrPath.startsWith('file://');
  const buffer = isUrl
    ? Buffer.from(await (await fetch(options.urlOrPath, { redirect: 'follow' })).arrayBuffer())
    : await readFile(options.urlOrPath);

  // 2) Tabula → CSV
  const csvText = await tabulaCsv(buffer, { pages: options.pages, mode: options.mode });

  // 3) Parse & headers
  const records = csvParse(csvText, { columns: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];

  if (!records.length) {
    return batchUpsertDutyRatesFromStream([], {
      batchSize: options.batchSize ?? 10_000,
      dryRun: options.dryRun,
      importId: options.importId,
      source: 'official',
      makeSourceRef: (row) => `cn:pdf/mfn:${row.hs6}`,
    });
  }

  const headers = Object.keys(records[0] ?? {});
  const hsCol = pickHeader(headers, HS_ALIASES);
  const descCol = pickHeader(headers, DESC_ALIASES);
  const rateCol = pickRateHeader(headers, options.columnHint);

  if (!hsCol || !rateCol) {
    throw new Error(
      `Could not detect HS/rate columns. Headers: ${headers.join(', ')} (hsCol=${hsCol}, rateCol=${rateCol})`
    );
  }

  const effectiveFrom = options.effectiveFrom ?? null;
  const effectiveTo = options.effectiveTo ?? null;
  const parents: DutyRateInsert[] = [];
  const parentKeys: ParentKey[] = [];
  const componentsByKey = new Map<string, DutyComponentInput[]>();

  type AliasRow = {
    system: 'CN8';
    code: string;
    title: string;
    chapter: number;
    heading4: string;
    hs6: string | null;
    isSpecial: boolean;
  };
  const aliasRows: AliasRow[] = [];

  for (const record of records) {
    const hsCell = record[hsCol];
    const hs6 = toHs6(hsCell);
    if (!hs6) continue;

    const rateCell = String(record[rateCol] ?? '').trim();
    if (!rateCell) continue;

    const parsed = parseCnRateComponents(rateCell);
    const headlinePct = parsed.advalPct != null ? String(parsed.advalPct) : '0';

    const parent: DutyRateInsert = {
      dest: 'CN',
      partner: '',
      hs6,
      dutyRule: 'mfn',
      ratePct: headlinePct,
      effectiveFrom,
      effectiveTo,
      currency: undefined,
      notes: undefined,
      source: undefined,
    };
    parents.push(parent);

    const key: ParentKey = { dest: 'CN', partner: '', hs6, dutyRule: 'mfn', effectiveFrom };
    const mapKey = `${key.dest}::${key.partner}::${key.hs6}::${key.dutyRule}::${
      effectiveFrom ? new Date(effectiveFrom).toISOString() : 'null'
    }`;

    const componentList: DutyComponentInput[] = [];

    if (parsed.advalPct != null) {
      componentList.push({
        type: 'advalorem',
        ratePct: parsed.advalPct,
        effectiveFrom,
        effectiveTo,
      });
    }

    for (const spec of parsed.specifics) {
      componentList.push({
        type: 'specific',
        amount: spec.amount,
        currency: normalizeCurrency(spec.currency),
        uom: normalizeUom(spec.uom),
        effectiveFrom,
        effectiveTo,
      });
    }

    if (parsed.minimum) {
      componentList.push({
        type: 'minimum',
        amount: parsed.minimum.amount,
        currency: normalizeCurrency(parsed.minimum.currency),
        uom: normalizeUom(parsed.minimum.uom),
        effectiveFrom,
        effectiveTo,
      });
    }

    if (parsed.maximum) {
      componentList.push({
        type: 'maximum',
        amount: parsed.maximum.amount,
        currency: normalizeCurrency(parsed.maximum.currency),
        uom: normalizeUom(parsed.maximum.uom),
        effectiveFrom,
        effectiveTo,
      });
    }

    // any "whichever" operator → write an 'other' component with a formula JSON
    if (parsed.combineOp) {
      componentList.push({
        type: 'other',
        formula: { op: parsed.combineOp, refs: ['advalorem', 'specific'] },
        notes:
          parsed.combineOp === 'max_of'
            ? '孰高适用 / whichever is higher'
            : '孰低适用 / whichever is lower',
        effectiveFrom,
        effectiveTo,
      } as DutyComponentInput);
    }

    if (componentList.length) componentsByKey.set(mapKey, componentList);
    parentKeys.push(key);

    // optional CN8 alias write
    if (options.writeAliases !== false) {
      const cn8 = toCn8(hsCell);
      if (cn8) {
        const chapter = Number(cn8.slice(0, 2));
        const heading4 = cn8.slice(0, 4);
        const isSpecial = chapter >= 98;
        const aliasHs6 = isSpecial ? null : hs6;
        const title = titleFromDescription(descCol ? record[descCol] : undefined);

        aliasRows.push({
          system: 'CN8',
          code: cn8,
          title,
          chapter,
          heading4,
          hs6: aliasHs6,
          isSpecial,
        });
      }
    }
  }

  // 5) Upsert parents
  const parentResult = await batchUpsertDutyRatesFromStream(parents, {
    batchSize: options.batchSize ?? 10_000,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) => `cn:pdf/mfn:${row.hs6}`,
  });

  // 6) Upsert components
  await upsertComponentsForParents({ parents: parentKeys, componentsByKey });

  // 7) Upsert CN8 aliases (idempotent)
  if (aliasRows.length && !options.dryRun) {
    // Insert-or-update title for (system, code)
    await db
      .insert(hsCodeAliasesTable)
      .values(
        aliasRows.map((a) => ({
          system: 'CN8' as const,
          code: a.code,
          title: a.title,
          chapter: a.chapter,
          heading4: a.heading4,
          hs6: a.hs6 ?? null,
          isSpecial: a.isSpecial,
          effectiveFrom: options.effectiveFrom ?? sql`now()`,
          effectiveTo: options.effectiveTo ?? null,
        }))
      )
      .onConflictDoUpdate({
        target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
        set: {
          title: sql`EXCLUDED.title`,
          chapter: sql`EXCLUDED.chapter`,
          heading4: sql`EXCLUDED.heading4`,
          hs6: sql`EXCLUDED.hs6`,
          isSpecial: sql`EXCLUDED.is_special`,
          effectiveFrom: sql`LEAST(${hsCodeAliasesTable.effectiveFrom}, EXCLUDED.effective_from)`,
          effectiveTo: sql`COALESCE(EXCLUDED.effective_to, ${hsCodeAliasesTable.effectiveTo})`,
          updatedAt: sql`now()`,
        },
      });
  }

  return parentResult;
}
