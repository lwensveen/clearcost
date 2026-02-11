import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import { fetchVatRowsFromOfficialSources } from '../../../modules/vat/services/fetch-vat-official.js';
import { importVatRules } from '../../../modules/vat/services/import-vat.js';
import { parseFlags } from '../utils.js';

const flagStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

const flagBool = (v: unknown): boolean => v === true || v === 'true' || v === '1';

type Flags = Record<string, string | boolean>;

export const vatAuto: Command = async (argv = []) => {
  const flags = parseFlags(argv) as Flags;

  const only = flagStr(flags.only).toLowerCase();
  const debug = flagBool(flags.debug);

  const skipOecd = flagBool(flags['skip-oecd']);
  const skipImf = flagBool(flags['skip-imf']);

  const wantOecd = skipOecd ? false : only ? only === 'oecd' : true;
  const wantImf = skipImf ? false : only ? only === 'imf' : true;

  // safety threshold (default 100; override via --min=300 or VAT_MIN_ROWS)
  const minRawFlag = flags.min;
  const minRawEnv = process.env.VAT_MIN_ROWS;
  const minRaw = typeof minRawFlag === 'string' ? minRawFlag : (minRawEnv ?? '100');
  const minNum = Number(minRaw);
  const minRows = Number.isFinite(minNum) && minNum > 0 ? Math.floor(minNum) : 100;

  console.log(`VAT: start (oecd=${wantOecd}, imf=${wantImf}, debug=${debug}, min=${minRows})`);

  const payload = await withRun({ importSource: 'OECD/IMF', job: 'vat:auto' }, async () => {
    console.log('VAT: fetching OECD + IMF workbooks…');
    const rows = await fetchVatRowsFromOfficialSources({ oecd: wantOecd, imf: wantImf, debug });
    console.log(`VAT: parsed ${rows.length} normalized rows`);

    if (rows.length < minRows) {
      throw new Error(`VAT importer parsed ${rows.length} rows, below threshold ${minRows}.`);
    }

    const res = await importVatRules(rows, { source: 'official' });
    const inserted = res?.count ?? rows.length ?? 0;
    return { inserted, payload: res };
  });

  console.log(payload);
};
