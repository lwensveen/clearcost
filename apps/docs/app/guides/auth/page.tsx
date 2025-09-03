export default function AuthGuide() {
  return (
    <main className="prose mx-auto px-6 py-10">
      <h1>Authentication</h1>
      <p>
        Authenticate every request with <code>X-API-Key</code>. Keys are scoped and may be rotated.
        Never embed a secret key in browser code—use the server proxy pattern.
      </p>

      <h2>Header</h2>
      <pre>
        <code>{`X-API-Key: <your-server-key>`}</code>
      </pre>

      <h2>Rotation</h2>
      <p>
        Use <code>POST /v1/admin/api-keys/:id/rotate</code> (admin) or
        <code> POST /v1/api-keys/self/rotate</code> (self). The plaintext token is shown once.
      </p>

      <h2>Scopes</h2>
      <p>
        Keys include scopes (e.g. <code>quotes:write</code>). Admin keys may include
        <code> admin:all</code>.
      </p>
    </main>
  );
}
