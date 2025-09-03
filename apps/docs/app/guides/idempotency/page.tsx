export default function IdempotencyGuide() {
  return (
    <main className="prose mx-auto px-6 py-10">
      <h1>Idempotency</h1>
      <p>
        For POST endpoints (e.g. <code>/v1/quotes</code>), include an <code>Idempotency-Key</code>{' '}
        header to safely retry a request. The same key + body yields the same result until the key
        expires.
      </p>
      <pre>
        <code>{`Idempotency-Key: ck_idem_123...`}</code>
      </pre>
      <p>
        Pick a unique key per logical operation (UUID). We recommend retaining it for at least a few
        minutes client-side to dedupe retries.
      </p>
    </main>
  );
}
