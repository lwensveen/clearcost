import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, KeyRound, Puzzle, ShieldCheck, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ClearCost — Landed cost at checkout speed',
  description:
    'Duty, VAT, fees, and freight—accurate landed cost quotes for cross-border commerce. API + embeddable widget.',
};

export default function HomePage() {
  return (
    <main className="relative">
      <section className="relative overflow-hidden">
        <div
          className={[
            'absolute inset-0 -z-10 bg-background',
            'bg-[radial-gradient(900px_500px_at_50%_-200px,oklch(0.96_0_0/.85),transparent_70%)]',
            'dark:bg-[radial-gradient(900px_500px_at_50%_-200px,oklch(0.22_0.02_255/.65),transparent_70%)]',
          ].join(' ')}
        />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="rounded-full">
              New: Widget + SDK
            </Badge>
            <h1 className="mt-3 font-heading text-4xl md:text-6xl font-semibold tracking-tight">
              Landed cost you can trust.
              <br className="hidden md:block" /> At checkout speed.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Clear, auditable duty/VAT and freight. Built for storefronts, marketplaces, and 3PLs.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/admin/api-keys">Get API key</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/docs">Read the docs</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>

          {/* Request / Response preview */}
          <div className="mt-10 md:mt-14 grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="text-xs font-medium text-muted-foreground mb-2">Request</div>
                <pre className="overflow-x-auto rounded-md bg-card text-card-foreground border border-border p-4 text-sm leading-relaxed">
                  {`POST /v1/quotes
Authorization: Bearer ck_***
Idempotency-Key: ck_idem_...

{
  "origin": "JP",
  "dest": "US",
  "itemValue": { "amount": 120, "currency": "USD" },
  "dimsCm": { "l": 30, "w": 20, "h": 15 },
  "weightKg": 2.3,
  "categoryKey": "collectibles.figure",
  "mode": "air"
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="text-xs font-medium text-muted-foreground mb-2">Response</div>
                <pre className="overflow-x-auto rounded-md bg-card text-card-foreground border border-border p-4 text-sm leading-relaxed">
                  {`{
  "total": { "amount": 42.78, "currency": "USD" },
  "breakdown": [
    { "type": "duty", "amount": 8.40 },
    { "type": "vat", "amount": 12.96 },
    { "type": "surcharges", "amount": 3.42 },
    { "type": "freight", "amount": 18.00 }
  ],
  "ruleRefs": ["US:HS 9503.00", "US:VAT import base CIF+DUTY"],
  "quoteId": "q_01H...",
  "expiresAt": "2025-09-01T00:00:00Z"
}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="features" className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Why ClearCost</h2>

          <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-3">
            <FeatureItem
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Accurate by design"
              desc="HS/De Minimis/VAT/surcharges modeled as versioned rules with effective dates and per-country logic."
            />
            <FeatureItem
              icon={<Zap className="h-5 w-5" />}
              title="Fast & idempotent"
              desc="Every quote is cached behind an Idempotency-Key; repeat calls are instant and safe to retry."
            />
            <FeatureItem
              icon={<Puzzle className="h-5 w-5" />}
              title="Widget or API"
              desc="Drop-in widget for carts and checkout, or call the REST API from your server."
            />
            <FeatureItem
              icon={<FileText className="h-5 w-5" />}
              title="Audit trail"
              desc="Persisted inputs/outputs and drift-ready fields for later review."
            />
            <FeatureItem
              icon={<KeyRound className="h-5 w-5" />}
              title="Scoped API keys"
              desc="Per-key scopes, usage metering, and exportable logs."
            />
            <FeatureItem
              icon={<BarChart3 className="h-5 w-5" />}
              title="Transparent pricing"
              desc="Simple tiers with no surprises."
            />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3 list-none">
            <Step n={1} title="Send item + lane">
              Origin/dest, value/currency, weight/dims, mode, and optional HS/category.
            </Step>
            <Step n={2} title="We compute landed cost">
              Duty, VAT, surcharges, and freight matched against effective rules for the lane.
            </Step>
            <Step n={3} title="You show the breakdown">
              Total + per-component lines, ready for checkout and post-purchase docs.
            </Step>
          </ol>
        </div>
      </section>

      <section id="pricing" className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-end justify-between">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Simple pricing</h2>
            <Button asChild variant="ghost">
              <Link href="/pricing">See full pricing →</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <PriceCard
              name="Developer"
              price="$0"
              lines={['1,000 requests/mo', 'Community support', 'API + Widget']}
              cta="/admin/api-keys"
            />
            <PriceCard
              name="Growth"
              price="$49/mo"
              lines={['50k requests/mo', 'Email support', 'Rate analytics']}
              cta="/admin/api-keys"
            />
            <PriceCard
              name="Scale"
              price="Custom"
              lines={['High TPS', 'SLA & SSO', 'Dedicated support']}
              cta="mailto:hello@clearcost.dev"
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h3 className="font-heading text-2xl font-semibold tracking-tight">
            Start in five minutes
          </h3>
          <p className="mt-2 text-muted-foreground">
            Generate a key, call <code className="font-mono">/v1/quotes</code>, ship confidently.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/admin/api-keys">Get API key</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border">
        {icon}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="list-none rounded-xl border bg-card p-5">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm">
        {n}
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </li>
  );
}

function PriceCard({
  name,
  price,
  lines,
  cta,
}: {
  name: string;
  price: string;
  lines: string[];
  cta: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-base font-medium">{name}</div>
      <div className="mt-2 font-heading text-3xl font-semibold tracking-tight">{price}</div>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>• {l}</li>
        ))}
      </ul>
      <div className="mt-6">
        <Button asChild className="w-full">
          <Link href={cta}>Get started</Link>
        </Button>
      </div>
    </div>
  );
}
