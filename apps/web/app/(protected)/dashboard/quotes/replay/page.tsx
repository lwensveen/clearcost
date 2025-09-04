import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type Quote = {
  hs6: string;
  currency?: string;
  incoterm?: 'DAP' | 'DDP';
  chargeableKg: number;
  freight: number;
  deMinimis?: {
    duty: { thresholdDest: number; deMinimisBasis: 'CIF' | 'INTRINSIC'; under: boolean } | null;
    vat: { thresholdDest: number; deMinimisBasis: 'CIF' | 'INTRINSIC'; under: boolean } | null;
    suppressDuty: boolean;
    suppressVAT: boolean;
  };
  components: {
    CIF: number;
    duty: number;
    vat: number;
    fees: number;
    checkoutVAT?: number;
  };
  total: number;
  guaranteedMax: number;
  policy: string;
};

function money(n?: number, c?: string) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'USD' }).format(n);
  } catch {
    return `${c ?? 'USD'} ${n.toFixed(2)}`;
  }
}

async function fetchReplay(key: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const url = `${base}/api/clearcost/quotes/by-key?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, { cache: 'no-store' });

  const contentType = r.headers.get('content-type') || '';
  const text = await r.text();

  if (!r.ok) {
    return { ok: false as const, errorText: text || `HTTP ${r.status}` };
  }

  if (contentType.includes('application/json')) {
    try {
      const data = JSON.parse(text) as Quote;
      return { ok: true as const, quote: data, raw: text };
    } catch {}
  }

  try {
    const data = JSON.parse(text) as Quote;
    return { ok: true as const, quote: data, raw: text };
  } catch {
    return { ok: true as const, quote: null, raw: text };
  }
}

export default async function ReplayQuote({
  searchParams,
}: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const key = Array.isArray(sp.key) ? sp.key[0] : sp.key;
  if (!key) notFound();

  const res = await fetchReplay(key);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Replay quote</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Idempotency key: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{key}</code>
          </p>
        </div>
        <Link
          href="//dashboard/quotes"
          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
        >
          Back to Quotes
        </Link>
      </div>

      {!res.ok ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Replay failed</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{res.errorText}</pre>
          </CardContent>
        </Card>
      ) : res.quote ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">HS6</div>
                  <div className="font-mono">{res.quote.hs6}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Incoterm</div>
                  <div>{res.quote.incoterm ?? '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Currency</div>
                  <div>{res.quote.currency ?? '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Chargeable kg</div>
                  <div>{res.quote.chargeableKg.toFixed(3)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Freight</div>
                  <div>{money(res.quote.freight, res.quote.currency)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Policy</div>
                  <div className="truncate">{res.quote.policy}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">CIF</div>
                  <div className="text-sm font-medium">
                    {money(res.quote.components.CIF, res.quote.currency)}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Duty</div>
                  <div className="text-sm font-medium">
                    {money(res.quote.components.duty, res.quote.currency)}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">VAT</div>
                  <div className="text-sm font-medium">
                    {money(res.quote.components.vat, res.quote.currency)}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Fees</div>
                  <div className="text-sm font-medium">
                    {money(res.quote.components.fees, res.quote.currency)}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  Total: {money(res.quote.total, res.quote.currency)}
                </Badge>
                <Badge variant="outline">
                  Guaranteed max: {money(res.quote.guaranteedMax, res.quote.currency)}
                </Badge>
                {res.quote.components.checkoutVAT != null && (
                  <Badge variant="outline">
                    Checkout VAT: {money(res.quote.components.checkoutVAT, res.quote.currency)}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{res.raw}</pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Raw response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{res.raw}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
