// Import EU trade-remedy surcharges (AD/CVD/Safeguard) from TARIC.
// v1 scope: ad-valorem components only; specific/compound are noted and skipped.
// You control which TARIC measureTypeIds count as “remedies” via opts.measureTypeIds.
//
// Reuses TARIC parsers from duty-rates EU base.

import type { SurchargeInsert } from '@clearcost/types';
import { importSurcharges } from '../import-surcharges.js';
import { adValoremPercentToFractionString } from '../pct.js';
import {
  ERGA_OMNES_ID,
  hs6 as toHs6,
  parseComponents,
  parseDutyExpressions,
  parseGeoAreaDescriptions,
  parseMeasures,
} from '../../../duty-rates/services/eu/base.js';

type ImportOpts = {
  /** limit to these HS6 codes (optional) */
  hs6List?: string[];
  /**
   * TARIC measure type IDs to include as remedies (e.g. AD/CVD/Safeguard).
   * Keep this explicit so we don’t guess; pass via env or route param.
   */
  measureTypeIds: string[];
  importId?: string;
  xmlMeasureUrl?: string;
  xmlComponentUrl?: string;
  xmlGeoDescUrl?: string;
  xmlDutyExprUrl?: string;
  language?: string; // defaults to EN
};

function resolveOriginIso2(geoId: string, geoName?: string): string | null {
  if (/^[A-Z]{2}$/i.test(geoId)) return geoId.toUpperCase();
  // Keep common union/group synthetic if you want; for now only ISO2.
  if (geoId === '1013') return 'EU';
  if ((geoName ?? '').toLowerCase().includes('european union')) return 'EU';
  return null;
}

export async function importEuTradeRemediesAsSurcharges(
  opts: ImportOpts
): Promise<{ ok: true; count: number }> {
  const hs6Allow = new Set((opts.hs6List ?? []).map(toHs6).filter(Boolean));
  const measureTypes = new Set((opts.measureTypeIds ?? []).filter(Boolean));

  if (measureTypes.size === 0) {
    throw new Error(
      '[EU surcharges] remedy import requires at least one measure type id to be configured.'
    );
  }

  const measureUrl = opts.xmlMeasureUrl ?? process.env.EU_TARIC_MEASURE_URL ?? '';
  const componentUrl = opts.xmlComponentUrl ?? process.env.EU_TARIC_COMPONENT_URL ?? '';
  const geoDescUrl = opts.xmlGeoDescUrl ?? process.env.EU_TARIC_GEO_DESC_URL ?? '';
  const dutyExprUrl = opts.xmlDutyExprUrl ?? process.env.EU_TARIC_DUTY_EXPR_URL ?? '';
  const lang = (opts.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();

  if (!measureUrl || !componentUrl) {
    throw new Error(
      '[EU surcharges] remedy import missing TARIC measure/component URLs. Check task env configuration.'
    );
  }

  // Optional geo names for nicer notes
  let geoNames = new Map<string, string>();
  if (geoDescUrl) {
    try {
      geoNames = await parseGeoAreaDescriptions(geoDescUrl, lang);
    } catch {
      /* ignore */
    }
  }

  // Ad-valorem expression allowlist (exact), otherwise component heuristic is used
  let adValoremExprIds: Set<string> | undefined;
  if (dutyExprUrl) {
    try {
      adValoremExprIds = await parseDutyExpressions(dutyExprUrl, lang);
    } catch {
      /* ignore */
    }
  }

  // Pull only remedy measures (non-ERGA), optionally HS6-allowlisted
  const measures = await parseMeasures(measureUrl, (m) => {
    if (!measureTypes.has(m.measureTypeId)) return false;
    if (m.geoId === ERGA_OMNES_ID) return false;
    const code6 = toHs6(m.code10);
    return !hs6Allow.size || hs6Allow.has(code6);
  });
  if (measures.size === 0) {
    throw new Error(
      '[EU surcharges] remedy import produced 0 measures. Check TARIC source availability and filters.'
    );
  }

  // Parse components; keep only ad-valorem
  const comps = await parseComponents(componentUrl, new Set(measures.keys()), adValoremExprIds);

  const out: SurchargeInsert[] = [];
  for (const [sid, m] of measures.entries()) {
    const c = comps.get(sid);
    if (!c || c.pct == null) continue; // skip non-% (specific/compound only)

    const start = m.start ? new Date(`${m.start}T00:00:00Z`) : undefined;
    if (!start) continue;
    const end = m.end ? new Date(`${m.end}T00:00:00Z`) : null;

    const geoName = geoNames.get(m.geoId);
    const origin = resolveOriginIso2(m.geoId, geoName);

    // Map TARIC measureTypeId to our surcharge code (AD/CVD/Safeguard).
    // You can refine/branch this if you pass separate type sets.
    const surchargeCode =
      /dump/i.test(geoName ?? '') || /ad/i.test(m.measureTypeId)
        ? 'ANTIDUMPING'
        : /countervail|subsid/i.test(geoName ?? '')
          ? 'COUNTERVAILING'
          : 'TRADE_REMEDY_232'; // reuse as generic “safeguard/other remedy” bucket if you like

    out.push({
      dest: 'EU',
      origin,
      hs6: toHs6(m.code10),
      surchargeCode: surchargeCode,
      pctAmt: adValoremPercentToFractionString(c.pct),
      fixedAmt: null,
      effectiveFrom: start,
      effectiveTo: end,
      notes:
        `${geoName ?? `geo:${m.geoId}`} – EU remedy (type ${m.measureTypeId})` +
        (c.compound ? '; contains compound/specific, using % only.' : ''),
    });
  }

  if (!out.length) {
    throw new Error(
      '[EU surcharges] remedy import produced 0 ad-valorem rows. Check component parsing and duty expressions.'
    );
  }

  const res = await importSurcharges(out);
  return { ok: true, count: res.count ?? out.length };
}
