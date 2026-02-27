import { describe, expect, it } from 'vitest';
import {
  evaluateCountryOfficialReadiness,
  parseRequestedCountrySlugs,
} from './duties-country-official-enabled.js';

type SourceRow = {
  key: string;
  enabled: boolean;
  baseUrl: string | null;
  downloadUrlTemplate: string | null;
};

describe('parseRequestedCountrySlugs', () => {
  it('normalizes and deduplicates explicit country slugs', () => {
    expect(parseRequestedCountrySlugs(['AU', 'au', ' nz '])).toEqual(['au', 'nz']);
  });

  it('throws for unknown slugs', () => {
    expect(() => parseRequestedCountrySlugs(['zz'])).toThrow(/Unknown duty country slug\(s\): zz/);
  });
});

describe('evaluateCountryOfficialReadiness', () => {
  it('marks country runnable when MFN and FTA URLs are configured in source_registry', () => {
    const rows: SourceRow[] = [
      {
        key: 'duties.au.official.mfn_excel',
        enabled: true,
        baseUrl: 'https://example.com/au-mfn.xlsx',
        downloadUrlTemplate: null,
      },
      {
        key: 'duties.au.official.fta_excel',
        enabled: true,
        baseUrl: null,
        downloadUrlTemplate: 'https://example.com/au-fta.xlsx',
      },
    ];

    const out = evaluateCountryOfficialReadiness({
      slugs: ['au'],
      rows,
      env: {},
    });

    expect(out).toEqual([
      {
        slug: 'au',
        commandKey: 'import:duties:au-all-official',
        mfnSourceKey: 'duties.au.official.mfn_excel',
        ftaSourceKey: 'duties.au.official.fta_excel',
        mfnReady: true,
        ftaReady: true,
        runnable: true,
        reasons: [],
      },
    ]);
  });

  it('uses env fallbacks when source_registry rows have no URL', () => {
    const rows: SourceRow[] = [
      {
        key: 'duties.au.official.mfn_excel',
        enabled: true,
        baseUrl: null,
        downloadUrlTemplate: null,
      },
      {
        key: 'duties.au.official.fta_excel',
        enabled: true,
        baseUrl: null,
        downloadUrlTemplate: null,
      },
    ];

    const out = evaluateCountryOfficialReadiness({
      slugs: ['au'],
      rows,
      env: {
        AU_MFN_OFFICIAL_EXCEL_URL: 'https://example.com/au-mfn-env.xlsx',
        AU_FTA_OFFICIAL_EXCEL_URL: 'https://example.com/au-fta-env.xlsx',
      },
    });

    expect(out[0]?.runnable).toBe(true);
    expect(out[0]?.reasons).toEqual([]);
  });

  it('skips country when one side is missing an enabled URL', () => {
    const rows: SourceRow[] = [
      {
        key: 'duties.nz.official.mfn_excel',
        enabled: true,
        baseUrl: 'https://example.com/nz-mfn.xlsx',
        downloadUrlTemplate: null,
      },
      {
        key: 'duties.nz.official.fta_excel',
        enabled: false,
        baseUrl: 'https://example.com/nz-fta.xlsx',
        downloadUrlTemplate: null,
      },
    ];

    const out = evaluateCountryOfficialReadiness({
      slugs: ['nz'],
      rows,
      env: {},
    });

    expect(out[0]?.runnable).toBe(false);
    expect(out[0]?.reasons).toEqual([
      'duties.nz.official.fta_excel has no enabled URL (source_registry or env fallback)',
    ]);
  });
});
