import { useState, useCallback, useEffect, useRef } from 'react';
import { callQuote, formatMoney } from './index.js';
import type { QuoteBody, QuoteResult, SDK } from './index.js';

export type ClearCostQuoteProps = {
  /** ISO 3166-1 alpha-2 origin country code */
  origin: string;
  /** ISO 3166-1 alpha-2 destination country code */
  dest: string;
  /** Declared item value */
  price: number;
  /** ISO 4217 currency code (default: USD) */
  currency?: string;
  /** Length in cm */
  l: number;
  /** Width in cm */
  w: number;
  /** Height in cm */
  h: number;
  /** Weight in kg */
  weight: number;
  /** Product category key (default: general) */
  categoryKey?: string;
  /** Optional HS6 tariff code */
  hs6?: string;
  /** Shipping mode (default: air) */
  mode?: 'air' | 'sea';
  /** Server-side proxy URL (recommended) */
  proxyUrl?: string;
  /** Direct API base URL */
  baseUrl?: string;
  /** Direct API key (not recommended for browser) */
  apiKey?: string;
  /** Auto-calculate on mount */
  auto?: boolean;
  /** Locale for currency formatting (default: en-US) */
  locale?: string;
  /** Additional CSS class name */
  className?: string;
};

export function ClearCostQuote(props: ClearCostQuoteProps) {
  const {
    origin,
    dest,
    price,
    currency = 'USD',
    l,
    w,
    h,
    weight,
    categoryKey = 'general',
    hs6,
    mode = 'air',
    proxyUrl,
    baseUrl,
    apiKey,
    auto = false,
    locale = 'en-US',
    className,
  } = props;

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const body: QuoteBody = {
    origin,
    dest,
    itemValue: { amount: price, currency },
    dimsCm: { l, w, h },
    weightKg: weight,
    categoryKey,
    hs6,
    mode,
  };

  const sdk: SDK = { proxyUrl, baseUrl, apiKey };

  const calculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = await callQuote(body, sdk);
      q.itemValue = price;
      setQuote(q);
      setHasRun(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setHasRun(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    origin,
    dest,
    price,
    currency,
    l,
    w,
    h,
    weight,
    categoryKey,
    hs6,
    mode,
    proxyUrl,
    baseUrl,
    apiKey,
  ]);

  // Auto-calculate on first render
  useAutoRun(auto, calculate);

  const displayCur = currency.toUpperCase();
  const money = (x: number) => formatMoney(Number(x) || 0, displayCur, locale);

  return (
    <div className={className ? `cc-wrap ${className}` : 'cc-wrap'}>
      <button className="cc-btn" onClick={calculate} disabled={loading}>
        {loading ? 'Calculating\u2026' : hasRun ? 'Recalculate' : 'Estimate duties & taxes'}
      </button>

      {error && (
        <div className="cc-result" style={{ color: '#dc2626' }}>
          Failed: {error}
        </div>
      )}

      {quote && (
        <div className="cc-result">
          <div className="cc-header">
            <strong>Landed cost</strong>
            <span className="cc-header-total">{money(quote.total)}</span>
          </div>
          <div className="cc-rows">
            <Row label="Freight" amount={Number(quote.components.CIF || 0) - price} money={money} />
            <Row label="Duty" amount={Number(quote.components.duty || 0)} money={money} />
            <Row label="VAT" amount={Number(quote.components.vat || 0)} money={money} />
            {quote.components.checkoutVAT !== undefined && (
              <Row
                label="Checkout VAT (IOSS)"
                amount={Number(quote.components.checkoutVAT || 0)}
                money={money}
              />
            )}
            <Row label="Fees" amount={Number(quote.components.fees || 0)} money={money} />
            <div className="cc-incoterm">
              Incoterm: <strong>{quote.incoterm ?? 'DAP'}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  amount,
  money,
}: {
  label: string;
  amount: number;
  money: (x: number) => string;
}) {
  return (
    <div className="cc-row">
      <span>{label}</span>
      <span>{money(amount)}</span>
    </div>
  );
}

/** Runs callback once on mount when `enabled` is true. */
function useAutoRun(enabled: boolean, fn: () => Promise<void>) {
  const ran = useRef(false);
  useEffect(() => {
    if (enabled && !ran.current) {
      ran.current = true;
      void fn();
    }
  }, [enabled, fn]);
}
