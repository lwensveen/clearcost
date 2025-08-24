# @clearcost/sdk

A lightweight TypeScript SDK for calling the ClearCost API from server-side code (Node/Next API routes, workers, etc.).

## Install

```bash
bun add @clearcost/sdk
```

## Configure

```ts
const sdk = { baseUrl: 'https://api.yourdomain.com', apiKey: 'ck_...' };
```

## Create a quote

```ts
import { createQuote } from '@clearcost/sdk';

const { quote } = await createQuote(sdk, {
  origin: 'JP',
  dest: 'US',
  itemValue: { amount: 120, currency: 'USD' },
  dimsCm: { l: 30, w: 20, h: 15 },
  weightKg: 2.3,
  categoryKey: 'collectibles.figure',
  mode: 'air',
});

console.log(quote.total);
```

## Classify (optional)

```ts
import { classify } from '@clearcost/sdk';

const { hs6, confidence } = await classify(sdk, {
  title: 'Resin figure 20cm',
  categoryKey: 'collectibles.figure',
});
```

## Server proxy example (Next.js API route)

```ts
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const idem = req.headers['idempotency-key'] as string;
  const r = await fetch(process.env.CLEARCOST_BASE_URL + '/v1/quotes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idem,
      authorization: `Bearer ${process.env.CLEARCOST_API_KEY}`,
    },
    body: JSON.stringify(req.body),
  });
  const data = await r.json();
  res.status(r.status).json(data);
}
```

## Idempotency

Always forward an `Idempotency-Key` header (use a UUID or a base64url random string). The API will return cached results
for repeats and reject mismatched payloads for the same key.

## Error handling

All functions throw on non-2xx responses. Catch and inspect `e.message`/response text. For validation issues, the API
returns a JSON body with details.

## Environment

- Use the SDK in server environments only. For browsers, use the **widget** or your own proxy.
- Required env on your server: `CLEARCOST_API_KEY`, `CLEARCOST_BASE_URL`.

## Types

- Fully typed inputs/outputs. Import any types you need from `@clearcost/sdk` or your generated `@clearcost/types`
  package.

## Rate limits

- Handle `429` by backing off and replaying with the same Idempotency-Key.

## Versioning

- Follows semver. Breaking changes will bump major versions.
