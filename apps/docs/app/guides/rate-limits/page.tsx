export default function RateLimitGuide() {
  return (
    <main className="prose mx-auto px-6 py-10">
      <h1>Rate limits</h1>
      <p>Requests are limited per key. We expose standard headers:</p>
      <ul>
        <li>
          <code>RateLimit-Limit</code>: quota for the current window
        </li>
        <li>
          <code>RateLimit-Remaining</code>: remaining requests
        </li>
        <li>
          <code>RateLimit-Reset</code>: UNIX epoch (sec) when the window resets
        </li>
      </ul>
      <p>
        Exceeding limits returns <code>429</code> and the headers above so you can retry after the
        reset time.
      </p>
    </main>
  );
}
