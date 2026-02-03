import type { LookupStatus } from '../../../lib/lookup-meta.js';

export type QuoteComponentConfidence = 'authoritative' | 'estimated' | 'missing';

export function deriveConfidenceFromStatus(status: LookupStatus): QuoteComponentConfidence {
  switch (status) {
    case 'ok':
    case 'no_match':
      return 'authoritative';
    case 'out_of_scope':
      return 'estimated';
    case 'no_dataset':
    case 'error':
      return 'missing';
    default:
      return 'missing';
  }
}

export function isMissingStatus(status: LookupStatus): boolean {
  return status === 'no_dataset' || status === 'error';
}

export function overallConfidenceFrom(
  parts: Record<string, QuoteComponentConfidence>
): QuoteComponentConfidence {
  const values = Object.values(parts);
  if (values.includes('missing')) return 'missing';
  if (values.includes('estimated')) return 'estimated';
  return 'authoritative';
}
