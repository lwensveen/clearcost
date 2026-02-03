import Link from 'next/link';

export default function QuickstartGuidePage() {
  return (
    <main className="prose mx-auto px-6 py-10">
      <h1>Quickstart (first quote in ~15 minutes)</h1>
      <p>
        This is the fastest production-safe path: create a server key, call <code>/v1/quotes</code>
        from your backend, then interpret confidence fields before rollout.
      </p>

      <h2>1) Create a scoped API key</h2>
      <p>
        Create a key with at least <code>quotes:write</code>. Keep it server-side only.
      </p>

      <h2>2) Call the quote API (curl)</h2>
      <pre>
        <code>{`curl -sS -X POST "$API/v1/quotes" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $CLEARCOST_API_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "origin":"US",
    "dest":"GB",
    "itemValue":{"amount":120,"currency":"USD"},
    "dimsCm":{"l":20,"w":15,"h":10},
    "weightKg":1.2,
    "categoryKey":"general",
    "mode":"air"
  }'`}</code>
      </pre>

      <h2>3) Minimal backend integration (Node.js)</h2>
      <pre>
        <code>{`const res = await fetch(\`\${process.env.CLEARCOST_API_URL}/v1/quotes\`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.CLEARCOST_API_KEY!,
    "idempotency-key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    origin: "US",
    dest: "GB",
    itemValue: { amount: 120, currency: "USD" },
    dimsCm: { l: 20, w: 15, h: 10 },
    weightKg: 1.2,
    categoryKey: "general",
    mode: "air",
  }),
});

if (!res.ok) throw new Error(await res.text());
const quote = await res.json();`}</code>
      </pre>

      <h2>4) Interpret confidence before going live</h2>
      <ul>
        <li>
          <code>componentConfidence</code>: per-component confidence.
        </li>
        <li>
          <code>overallConfidence</code>: worst-of component confidence.
        </li>
        <li>
          <code>missingComponents</code>: components with missing data/error states.
        </li>
      </ul>
      <p>
        Read <Link href="/guides/quote-confidence">Quote confidence</Link> before production
        rollout.
      </p>

      <h2>5) Production guardrails</h2>
      <ul>
        <li>Always send idempotency keys on quote requests.</li>
        <li>Treat `overallConfidence=&quot;missing&quot;` as a fallback/escalation case.</li>
        <li>Track import freshness as part of release readiness.</li>
      </ul>
    </main>
  );
}
