'use client';

import { useMemo, useState } from 'react';
import type { QuoteResponse } from '@clearcost/types';

const ORIGINS = ['US', 'NL'] as const;
const DESTINATIONS = ['NL', 'DE'] as const;
const HS6_OPTIONS = ['850440', '851830', '852290', '852910'] as const;
const CURRENCIES = ['USD', 'EUR'] as const;

type Origin = (typeof ORIGINS)[number];
type Destination = (typeof DESTINATIONS)[number];
type Hs6 = (typeof HS6_OPTIONS)[number];
type Currency = (typeof CURRENCIES)[number];

type FormState = {
  origin: Origin;
  dest: Destination;
  hs6: Hs6;
  declaredValue: string;
  currency: Currency;
};

type ApiErrorEnvelope = {
  error?: { code?: string; message?: string } | string;
  code?: string;
  message?: string;
};

const MVP_SCOPE_ERROR =
  'This MVP only supports US/NL -> NL/DE, electronics accessories (HS 85), under €150.';
const DATA_NOT_READY_ERROR = 'Required FX/VAT/duty data not available. Please try again later.';
const ABOVE_DE_MINIMIS_ERROR = 'Declared value exceeds €150 de-minimis limit for this MVP.';
const GENERIC_SERVER_ERROR = 'Something went wrong while generating the quote. Please try again.';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
const QUOTE_URL = `${API_BASE}/v1/quotes`;

function mapError(code: string | null, status: number, fallbackMessage: string): string {
  if (code === 'unsupported_lane_or_scope') return MVP_SCOPE_ERROR;
  if (code === 'data_not_ready') return DATA_NOT_READY_ERROR;
  if (code === 'above_de_minimis') return ABOVE_DE_MINIMIS_ERROR;
  if (status === 500) return GENERIC_SERVER_ERROR;
  return fallbackMessage || 'Request failed.';
}

function money(value: number | undefined | null): string {
  return Number(value ?? 0).toFixed(2);
}

function idempotencyKey(): string {
  return `playground-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function PlaygroundPage() {
  const [form, setForm] = useState<FormState>({
    origin: 'US',
    dest: 'NL',
    hs6: '850440',
    declaredValue: '100',
    currency: 'USD',
  });
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);

  const declaredValue = Number(form.declaredValue);
  const canSubmit = Number.isFinite(declaredValue) && declaredValue > 0;
  const freshnessText = useMemo(
    () => JSON.stringify(quote?.metadata?.dataFreshness ?? 'n/a', null, 2),
    [quote]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    setServerError(null);
    setQuote(null);

    if (!canSubmit) {
      setClientError('Please enter a declared value greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(QUOTE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey(),
        },
        body: JSON.stringify({
          origin: form.origin,
          dest: form.dest,
          itemValue: { amount: declaredValue, currency: form.currency },
          dimsCm: { l: 20, w: 15, h: 10 },
          weightKg: 1,
          categoryKey: 'electronics_accessories',
          hs6: form.hs6,
          mode: 'air',
        }),
        cache: 'no-store',
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const envelope =
          body && typeof body === 'object' ? (body as ApiErrorEnvelope) : ({} as ApiErrorEnvelope);
        const errorObject =
          envelope.error && typeof envelope.error === 'object' ? envelope.error : null;
        const code =
          errorObject?.code ??
          (typeof envelope.error === 'string'
            ? envelope.error
            : typeof envelope.code === 'string'
              ? envelope.code
              : null);
        const fallbackMessage =
          errorObject?.message ??
          (typeof envelope.message === 'string'
            ? envelope.message
            : `Request failed (${response.status}).`);
        setServerError(mapError(code, response.status, fallbackMessage));
        return;
      }

      if (!body || typeof body !== 'object') {
        setServerError('Unexpected response from /v1/quotes.');
        return;
      }
      setQuote(body as QuoteResponse);
    } catch {
      setServerError('Network error while calling /v1/quotes.');
    } finally {
      setLoading(false);
    }
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Landed Cost Playground (MVP)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Submit a quote for the MVP lane scope. Mode is fixed to <code>air</code>.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Origin"
            value={form.origin}
            options={ORIGINS}
            onChange={(v) => setField('origin', v)}
          />
          <SelectField
            label="Destination"
            value={form.dest}
            options={DESTINATIONS}
            onChange={(v) => setField('dest', v)}
          />
          <SelectField
            label="HS6"
            value={form.hs6}
            options={HS6_OPTIONS}
            onChange={(v) => setField('hs6', v)}
          />
          <SelectField
            label="Currency"
            value={form.currency}
            options={CURRENCIES}
            onChange={(v) => setField('currency', v)}
          />

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Declared value</span>
            <input
              className="w-full rounded border bg-background p-2"
              type="number"
              min="0.01"
              step="0.01"
              value={form.declaredValue}
              onChange={(e) => setField('declaredValue', e.target.value)}
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="rounded border px-4 py-2 text-sm disabled:opacity-60"
        >
          {loading ? 'Calculating...' : 'Get quote'}
        </button>

        {clientError ? <p className="text-sm text-red-600">{clientError}</p> : null}
        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      </form>

      {quote ? (
        <section className="mt-6 rounded border p-4">
          <h2 className="text-lg font-medium">Quote breakdown</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <p>Customs value (EUR): {money(quote.components?.CIF)}</p>
            <p>Duty amount: {money(quote.dutyAmount ?? quote.components?.duty)}</p>
            <p>VAT amount: {money(quote.vatAmount ?? quote.components?.vat)}</p>
            <p className="font-medium">
              Total landed cost: {money(quote.totalLandedCost ?? quote.total)}
            </p>
            <p>FX rate: {quote.fxRate?.rate != null ? quote.fxRate.rate.toFixed(2) : 'n/a'}</p>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium">Data freshness</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-3 text-xs">{freshnessText}</pre>
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-sm text-muted-foreground">
        ClearCost MVP supports limited lanes and product types. This tool provides a cost estimate
        based on available duty/VAT data. It is not a filing service and does not guarantee final
        customs assessment.
      </p>
    </main>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <select
        className="w-full rounded border bg-background p-2"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        required
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
