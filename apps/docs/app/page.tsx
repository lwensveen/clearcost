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
            Start with <Link href="/api-reference">API reference</Link>.
          </li>
          <li>
            Try live requests in <Link href="/playground">Playground</Link>.
          </li>
          <li>
            Read <Link href="/guides/quote-confidence">Quote confidence</Link> before rollout.
          </li>
        </ol>

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
      </footer>
    </div>
  );
}
