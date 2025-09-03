export default function ErrorsGuide() {
  return (
    <main className="prose mx-auto px-6 py-10">
      <h1>Error handling</h1>
      <p>Errors are normalized as:</p>
      <pre>
        <code>{`HTTP/4xx-5xx
{
  "error": {
    "code": "ERR_SOMETHING",
    "message": "human readable message"
  }
}`}</code>
      </pre>

      <h2>Common statuses</h2>
      <ul>
        <li>
          <strong>400</strong> — invalid request
        </li>
        <li>
          <strong>401</strong> — missing/invalid API key
        </li>
        <li>
          <strong>403</strong> — insufficient scopes
        </li>
        <li>
          <strong>409</strong> — idempotency body mismatch
        </li>
        <li>
          <strong>429</strong> — rate limit exceeded
        </li>
        <li>
          <strong>500</strong> — unexpected
        </li>
      </ul>
    </main>
  );
}
