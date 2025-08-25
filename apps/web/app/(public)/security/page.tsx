export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16 prose prose-neutral dark:prose-invert">
      <h1>Security</h1>
      <p>We take data protection seriously. Highlights:</p>
      <ul>
        <li>API keys stored as SHA-256 hashes with pepper; per-key scopes & usage metering.</li>
        <li>Idempotent quote endpoints to avoid duplicate actions and race conditions.</li>
        <li>Encrypted transport (TLS), database encryption-at-rest via cloud provider.</li>
        <li>Least-privilege infra, audit logs for admin actions.</li>
      </ul>
      <h2>Reporting</h2>
      <p>
        Found a vulnerability? Email{' '}
        <a href="mailto:security@clearcost.dev">security@clearcost.dev</a>.
      </p>
    </main>
  );
}
