import type { LookupMeta } from '../../../lib/lookup-meta.js';

export type QuoteSourceMetadata = {
  provider: null;
  dataset: string | null;
  asOf: null;
  effectiveFrom: string | null;
};

export function toQuoteSourceMetadata(
  meta: Pick<LookupMeta, 'dataset' | 'effectiveFrom'> | null | undefined
): QuoteSourceMetadata {
  return {
    provider: null,
    dataset: meta?.dataset ?? null,
    asOf: null,
    effectiveFrom: meta?.effectiveFrom ? meta.effectiveFrom.toISOString() : null,
  };
}
