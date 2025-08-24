# @clearcost/widget

An embeddable checkout widget that calculates landed cost (duty, VAT, fees, freight) at checkout. Ships as both **IIFE
** (for `<script>` tags) and **ESM** builds.

## Features

- One-line install on storefronts via `<script>`
- Proxy-first design (keep your ClearCost API key server-side)
- Idempotent requests with `Idempotency-Key`
- Clean breakdown UI (totals + components)
- Locale/currency formatting

## Builds

- `dist/widget.iife.js` — global `ClearCostWidget`
- `dist/widget.esm.js` — ESM import

### Build from source

```bash
bun install
bun run build
# outputs to dist/
```

## Quick start (recommended: proxy)

Add the script to your storefront and call `mountAll` with your **proxy** endpoint:

```html
<script src="/static/clearcost/widget.iife.js"></script>
<script>
  ClearCostWidget.mountAll({
    proxyUrl: '/api/clearcost/quote',
    auto: true,
    locale: 'en-US',
  });
</script>

<div
  data-clearcost
  data-origin="JP"
  data-dest="US"
  data-price="129"
  data-currency="USD"
  data-l="30"
  data-w="20"
  data-h="15"
  data-weight="2.3"
  data-mode="air"
  data-category-key="collectibles.figure"
></div>
```

**Why proxy?** Keeps your API key off the browser. Your proxy route simply forwards the body to `POST /v1/quotes` with
your server-held key and passes through the `Idempotency-Key` header.

### ESM usage (SPA)

```ts
import { mountAll } from '@clearcost/widget';

mountAll({ proxyUrl: '/api/clearcost/quote', auto: false });
```

## Options

```ts
mountAll({
    // Prefer one of these patterns
    proxyUrl? : string;        // e.g. '/api/clearcost/quote' (recommended)
    baseUrl? : string;         // if calling API directly (not recommended)
    apiKey? : string;          // only for direct calls

    // UX
    auto? : boolean;           // run immediately on mount (default: false)
    locale? : string;          // e.g. 'en-US'
    currency? : string;        // display currency override
});
```

## Data attributes (per widget node)

| Attribute                  | Type              | Notes                         |
| -------------------------- | ----------------- | ----------------------------- |
| `data-origin`              | string            | ISO country (export)          |
| `data-dest`                | string            | ISO country (import)          |
| `data-price`               | number            | Declared value amount         |
| `data-currency`            | string            | e.g. `USD`                    |
| `data-l`/`data-w`/`data-h` | number            | Dimensions in cm              |
| `data-weight`              | number            | Kg                            |
| `data-mode`                | `air`\|`sea`      | Shipment mode                 |
| `data-category-key`        | string            | Your catalog/category mapping |
| `data-hs6`                 | string (optional) | User-supplied HS6 override    |

## Security

- **Always prefer `proxyUrl`**; never expose a full-power API key in browsers.
- The widget generates a unique `Idempotency-Key` per request; forward it to your API to dedupe.

## Customization

- The default UI is minimal and inline. You can wrap the widget node in your own card or container.
- For advanced layouts, fork the widget or render your own UI using the **SDK** directly.

## Troubleshooting

- **403/401**: Your proxy isn’t adding the `Authorization: Bearer` header.
- **CORS**: If calling API directly, ensure the API allows your origin (again, proxy is better).
- **No output**: Check the console for thrown errors from the fetch call.
