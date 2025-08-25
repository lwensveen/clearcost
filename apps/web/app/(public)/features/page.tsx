function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-base font-medium">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Features</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Feature
          title="Accurate by design"
          desc="HS / De Minimis / VAT / surcharges modeled as versioned rules with effective dates and per-country logic."
        />
        <Feature
          title="Fast & idempotent"
          desc="Every quote is cached behind an Idempotency-Key; repeat calls are instant and safe to retry."
        />
        <Feature
          title="Widget or API"
          desc="Drop-in widget for carts and checkout, or call the REST API from your server."
        />
        <Feature
          title="Audit trail"
          desc="Persisted inputs/outputs and drift-ready fields for later review."
        />
        <Feature
          title="Role-based API keys"
          desc="Per-key scopes, usage metering, and exportable logs."
        />
        <Feature title="Transparent pricing" desc="Simple tiers with no surprises." />
      </div>
    </main>
  );
}
