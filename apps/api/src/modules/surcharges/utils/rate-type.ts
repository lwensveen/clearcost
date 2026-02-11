export type SurchargeRateType = 'ad_valorem' | 'fixed' | 'per_unit';

function hasNumeric(v: unknown): boolean {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
}

function normalizeRateType(raw: string | null | undefined): SurchargeRateType | null {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (normalized === 'ad_valorem') return 'ad_valorem';
  if (normalized === 'fixed') return 'fixed';
  if (normalized === 'per_unit' || normalized === 'unit') return 'per_unit';
  return null;
}

function throwRateTypeError(message: string, rowLabel: string): never {
  throw new Error(`[Surcharges] ${message} at ${rowLabel}.`);
}

export function resolveSurchargeRateType(args: {
  rawRateType?: string | null;
  fixedAmt?: unknown;
  pctAmt?: unknown;
  unitAmt?: unknown;
  rowLabel: string;
}): SurchargeRateType {
  const hasFixed = hasNumeric(args.fixedAmt);
  const hasPct = hasNumeric(args.pctAmt);
  const hasUnit = hasNumeric(args.unitAmt);
  const explicit = normalizeRateType(args.rawRateType);

  if (args.rawRateType != null && String(args.rawRateType).trim().length > 0 && !explicit) {
    throwRateTypeError(`Invalid surcharge rateType "${String(args.rawRateType)}"`, args.rowLabel);
  }

  if (explicit === 'ad_valorem') {
    if (!hasPct) {
      throwRateTypeError('ad_valorem rows require pctAmt', args.rowLabel);
    }
    if (hasFixed || hasUnit) {
      throwRateTypeError(
        'ad_valorem rows must not include fixedAmt or unitAmt (split into separate rows)',
        args.rowLabel
      );
    }
    return explicit;
  }

  if (explicit === 'fixed') {
    if (!hasFixed && !hasUnit) {
      throwRateTypeError('fixed rows require fixedAmt or unitAmt', args.rowLabel);
    }
    if (hasPct) {
      throwRateTypeError(
        'fixed rows must not include pctAmt (split into separate rows)',
        args.rowLabel
      );
    }
    return explicit;
  }

  if (explicit === 'per_unit') {
    if (!hasUnit) {
      throwRateTypeError('per_unit rows require unitAmt', args.rowLabel);
    }
    if (hasFixed || hasPct) {
      throwRateTypeError(
        'per_unit rows must not include fixedAmt or pctAmt (split into separate rows)',
        args.rowLabel
      );
    }
    return explicit;
  }

  const inferred: SurchargeRateType[] = [];
  if (hasPct) inferred.push('ad_valorem');
  if (hasFixed) inferred.push('fixed');
  if (hasUnit) inferred.push('per_unit');

  if (inferred.length === 1) return inferred[0]!;
  if (inferred.length === 0) {
    throwRateTypeError(
      'Unable to infer surcharge rateType: include one of pctAmt/fixedAmt/unitAmt or provide rateType',
      args.rowLabel
    );
  }
  throwRateTypeError(
    'Ambiguous surcharge rateType: row includes multiple amount modes (pctAmt/fixedAmt/unitAmt)',
    args.rowLabel
  );
}
