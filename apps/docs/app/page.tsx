import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className="text-3xl font-semibold tracking-tight">ClearCost Docs</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          API-first landed-cost documentation for quotes, classifications, auth, and operational
          behavior.
        </p>
        <ol>
          <li>
            Start with <Link href="/guides/quickstart">Quickstart</Link>.
          </li>
          <li>
            Review <Link href="/api-reference">API reference</Link>.
          </li>
          <li>
            Try live requests in <Link href="/playground">Playground</Link>.
          </li>
          <li>
            Read <Link href="/guides/quote-confidence">Quote confidence</Link> before rollout.
          </li>
        </ol>

        <div>
          <h2 className="text-lg font-semibold mb-2">Quick integration</h2>
          <pre
            style={{
              background: 'var(--gray-alpha-100)',
              borderRadius: 8,
              padding: 16,
              fontSize: 13,
              lineHeight: 1.5,
              overflowX: 'auto',
            }}
          >
            <code>{`curl -X POST "$API/v1/quotes" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $CLEARCOST_API_KEY" \\
  -d '{"origin":"US","dest":"DE",
       "itemValue":{"amount":120,"currency":"USD"},
       "dimsCm":{"l":20,"w":15,"h":10},
       "weightKg":1.2,"categoryKey":"general","mode":"air"}'`}</code>
          </pre>
        </div>

        <div className={styles.ctas}>
          <Link className={styles.primary} href="/api-reference">
            Quotes API
          </Link>
          <Link className={styles.secondary} href="/guides/auth">
            Auth guide
          </Link>
        </div>
      </main>
      <footer className={styles.footer}>
        <Link href="/guides/errors">Error envelope</Link>
        <Link href="/guides/idempotency">Idempotency</Link>
        <Link href="/guides/quickstart">Quickstart</Link>
      </footer>
    </div>
  );
}
