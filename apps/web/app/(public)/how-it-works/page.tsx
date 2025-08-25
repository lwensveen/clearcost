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

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-semibold">How it works</h1>
      <ol className="mt-8 grid gap-6 md:grid-cols-3 list-none">
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
    </main>
  );
}
