import type { LookupStatus } from '../../../lib/lookup-meta.js';

export type QuoteComponentConfidence = 'authoritative' | 'estimated' | 'missing';
export type QuoteConfidenceComponent = 'duty' | 'vat' | 'surcharges' | 'freight' | 'fx';

type QuoteComponentStatuses = Record<Exclude<QuoteConfidenceComponent, 'fx'>, LookupStatus>;

export function deriveQuoteConfidenceParts(input: {
  statuses: QuoteComponentStatuses;
  fxMissingRate: boolean;
  freightOverridden?: boolean;
}): {
  componentConfidence: Record<QuoteConfidenceComponent, QuoteComponentConfidence>;
  overallConfidence: QuoteComponentConfidence;
  missingComponents: QuoteConfidenceComponent[];
} {
  const freightConfidence = input.freightOverridden
    ? 'estimated'
    : deriveConfidenceFromStatus(input.statuses.freight);
  const fxConfidence: QuoteComponentConfidence = input.fxMissingRate ? 'missing' : 'authoritative';

  const componentConfidence: Record<QuoteConfidenceComponent, QuoteComponentConfidence> = {
    duty: deriveConfidenceFromStatus(input.statuses.duty),
    vat: deriveConfidenceFromStatus(input.statuses.vat),
    surcharges: deriveConfidenceFromStatus(input.statuses.surcharges),
    freight: freightConfidence,
    fx: fxConfidence,
  };

  const missingComponents: QuoteConfidenceComponent[] = [];
  if (isMissingStatus(input.statuses.duty)) missingComponents.push('duty');
  if (isMissingStatus(input.statuses.vat)) missingComponents.push('vat');
  if (isMissingStatus(input.statuses.surcharges)) missingComponents.push('surcharges');
  if (isMissingStatus(input.statuses.freight) && !input.freightOverridden) {
    missingComponents.push('freight');
  }
  if (input.fxMissingRate) missingComponents.push('fx');

  return {
    componentConfidence,
    overallConfidence: overallConfidenceFrom(componentConfidence),
    missingComponents,
  };
}

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
