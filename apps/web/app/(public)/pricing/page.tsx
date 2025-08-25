import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, HelpCircle, ReceiptText, X } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing — ClearCost',
  description: 'Simple plans for landed-cost quotes. Start free, scale as you grow.',
};

type Plan = {
  name: string;
  price: string;
  blurb: string;
  cta: string;
  features: string[];
  limits: string[];
  popular?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Developer',
    price: '$0',
    blurb: 'Build and test. Ideal for pilots and small stores.',
    cta: '/admin/api-keys',
    features: ['API + Widget', 'Idempotency', 'Rate analytics (basic)'],
    limits: ['1,000 requests/mo', 'Community support'],
  },
  {
    name: 'Growth',
    price: '$49/mo',
    blurb: 'For production stores and marketplaces.',
    cta: '/admin/api-keys',
    features: ['API + Widget', 'Idempotency', 'Rate analytics (full)', 'Email support'],
    limits: ['50k requests/mo', 'Burst-friendly rate limits'],
    popular: true,
  },
  {
    name: 'Scale',
    price: 'Custom',
    blurb: 'High TPS, compliance, and dedicated support.',
    cta: 'mailto:hello@clearcost.dev',
    features: ['SLA & SSO', 'Custom rate limits', 'Dedicated support'],
    limits: ['Volume pricing', 'Custom terms'],
  },
];

// Feature comparison matrix
const matrix = [
  { label: 'Landed-cost API & Widget', dev: true, growth: true, scale: true },
  { label: 'Idempotency & retries', dev: true, growth: true, scale: true },
  { label: 'Audit/usage exports (CSV)', dev: false, growth: true, scale: true },
  { label: 'Email support', dev: false, growth: true, scale: true },
  { label: 'SSO (SAML/OIDC)', dev: false, growth: false, scale: true },
  { label: 'SLA & DPA', dev: false, growth: false, scale: true },
];

function FeatureBool({ ok }: { ok: boolean }) {
  return ok ? (
    <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15 text-green-600">
      <Check className="h-3.5 w-3.5" />
    </div>
  ) : (
    <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <X className="h-3.5 w-3.5" />
    </div>
  );
}

function PlanCard({ p }: { p: Plan }) {
  return (
    <div
      className={[
        'rounded-xl border bg-card p-6',
        p.popular ? 'border-2 ring-4 ring-primary/10' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div className="text-base font-medium">{p.name}</div>
        {p.popular && <Badge>Most popular</Badge>}
      </div>
      <div className="mt-2 font-heading text-3xl font-semibold tracking-tight">{p.price}</div>
      <p className="mt-2 text-sm text-muted-foreground">{p.blurb}</p>

      <ul className="mt-4 space-y-2 text-sm">
        {p.features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" /> {f}
          </li>
        ))}
      </ul>

      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {p.limits.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>

      <div className="mt-6">
        <Button asChild className="w-full">
          <Link href={p.cta}>Get started</Link>
        </Button>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <header>
        <h1 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
          Simple pricing
        </h1>
        <p className="mt-2 text-muted-foreground">Start free. Scale as you grow.</p>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.name} p={p} />
        ))}
      </section>

      <section className="mt-16">
        <h2 className="font-heading text-xl font-semibold">Compare features</h2>
        <div className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Feature</th>
                <th className="p-3 font-medium">Developer</th>
                <th className="p-3 font-medium">Growth</th>
                <th className="p-3 font-medium">Scale</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {matrix.map((row) => (
                <tr key={row.label}>
                  <td className="p-3">{row.label}</td>
                  <td className="p-3">
                    <FeatureBool ok={row.dev} />
                  </td>
                  <td className="p-3">
                    <FeatureBool ok={row.growth} />
                  </td>
                  <td className="p-3">
                    <FeatureBool ok={row.scale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 font-medium">
            <ReceiptText className="h-4 w-4" />
            What counts as a request?
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A single call to <code className="font-mono">POST /v1/quotes</code> that returns a
            response (including cached/idempotent responses) counts as one request.
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4" />
            Rate limits
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Reasonable burst limits per key to protect the service. Growth and Scale include higher
            bursts. Contact us for specific numbers if you need them raised.
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 font-medium">
            <HelpCircle className="h-4 w-4" />
            Billing & overage
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Plans include their monthly quota. Overage is metered. You can export usage by key from
            the dashboard at any time.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-heading text-xl font-semibold">FAQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Faq
            q="Can I self-host?"
            a="Not at the moment. ClearCost runs as a managed service with versioned rules and usage-based metering."
          />
          <Faq
            q="Do retries cost money?"
            a="Idempotent retries return cached results and still count as one request each time they’re served."
          />
          <Faq
            q="How do I cancel?"
            a="You can downgrade or cancel any time from the dashboard. Changes take effect next billing cycle."
          />
          <Faq
            q="Do you offer annual billing?"
            a="Yes—contact us for annual terms and volume pricing on the Scale plan."
          />
        </div>
      </section>

      <section className="mt-16 text-center">
        <div className="inline-flex flex-col items-center gap-3 rounded-xl border p-6">
          <div className="font-heading text-xl font-semibold">Start in minutes</div>
          <p className="text-sm text-muted-foreground">
            Generate a key, call <code className="font-mono">/v1/quotes</code>, ship confidently.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/admin/api-keys">Get API key</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer select-none font-medium">
        {q}
        <span className="float-right text-muted-foreground group-open:hidden">+</span>
        <span className="float-right text-muted-foreground hidden group-open:inline">−</span>
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
