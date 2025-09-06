import { tmpdir } from 'node:os';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createReadStream } from 'node:fs';
import unzipper from 'unzipper';
import { getDailyZipUrlForDate, getLatestDailyZipUrl } from './taric-daily-list.js';
import { importEuMfn } from './import-mfn.js';
import { importEuPreferential } from './import-preferential.js';

type ImportResult = {
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  dryRun?: boolean;
};

export async function importEuFromDaily({
  date,
  include = 'both',
  partnerGeoIds,
  batchSize,
  importId,
  dryRun,
}: {
  /** YYYY-MM-DD (optional: latest if omitted) */
  date?: string;
  include?: 'mfn' | 'fta' | 'both';
  partnerGeoIds?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
}): Promise<ImportResult> {
  const listUrl =
    process.env.EU_TARIC_DAILY_LIST ??
    'https://ec.europa.eu/taxation_customs/dds2/taric/daily_publications.jsp?Lang=en';

  const zipUrl = date
    ? await getDailyZipUrlForDate(date, listUrl)
    : await getLatestDailyZipUrl(listUrl);

  const res = await fetch(zipUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const dir = await mkdtemp(join(tmpdir(), 'taric-'));
  const zipPath = join(dir, 'daily.zip');
  await writeFile(zipPath, buf);

  try {
    await new Promise<void>((resolve, reject) => {
      createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: dir }))
        .on('close', resolve)
        .on('error', reject);
    });

    // case-insensitive file map
    const filesByUpper = (await readdir(dir)).reduce<Record<string, string>>((acc, f) => {
      acc[f.toUpperCase()] = f;
      return acc;
    }, {});
    const measure = filesByUpper['MEASURE.XML'];
    const component = filesByUpper['MEASURE_COMPONENT.XML'];
    const dutyExpr = filesByUpper['DUTY_EXPRESSION_DESCRIPTION.XML'];
    const geoDesc = filesByUpper['GEOGRAPHICAL_AREA_DESCRIPTION.XML'];
    if (!measure || !component) {
      throw new Error('Daily ZIP missing MEASURE.xml / MEASURE_COMPONENT.xml');
    }

    const xml = {
      measureUrl: `file://${join(dir, measure)}`,
      componentUrl: `file://${join(dir, component)}`,
      dutyExprUrl: dutyExpr ? `file://${join(dir, dutyExpr)}` : undefined,
      geoDescUrl: geoDesc ? `file://${join(dir, geoDesc)}` : undefined,
      language: process.env.EU_TARIC_LANGUAGE ?? 'EN',
    };

    let inserted = 0;
    let updated = 0;

    if (include === 'mfn' || include === 'both') {
      const r = await importEuMfn({
        batchSize,
        importId,
        dryRun,
        xml: {
          measureUrl: xml.measureUrl,
          componentUrl: xml.componentUrl,
          dutyExprUrl: xml.dutyExprUrl,
          language: xml.language,
        },
      });
      inserted += r.inserted ?? 0;
      updated += r.updated ?? 0;
    }

    if (include === 'fta' || include === 'both') {
      const r = await importEuPreferential({
        partnerGeoIds,
        batchSize,
        importId,
        dryRun,
        xml: {
          measureUrl: xml.measureUrl,
          componentUrl: xml.componentUrl,
          geoDescUrl: xml.geoDescUrl,
          dutyExprUrl: xml.dutyExprUrl,
          language: xml.language,
        },
      });
      inserted += r.inserted ?? 0;
      updated += r.updated ?? 0;
    }

    return {
      ok: true,
      inserted,
      updated,
      count: inserted + updated,
      dryRun: dryRun,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
