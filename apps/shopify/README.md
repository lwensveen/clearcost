# ClearCost Shopify App

Full Shopify app with embedded admin UI and checkout extension that displays estimated import duties, VAT, and total landed cost at checkout for cross-border orders.

## Architecture

```
apps/shopify/
  app/                     ← Remix web server (embedded admin)
    routes/
      _index.tsx           ← Login / redirect
      auth.$.tsx           ← OAuth catch-all
      app.tsx              ← Admin layout (Polaris + App Bridge)
      app._index.tsx       ← Settings page (API key, origin country)
      webhooks.tsx         ← APP_UNINSTALLED + GDPR handlers
      apps.clearcost.quote.tsx  ← App proxy (checkout → ClearCost API)
    shopify.server.ts      ← Shopify auth + session config
    db.server.ts           ← Prisma client singleton
  extensions/
    clearcost-duties/      ← Checkout UI extension
      src/Checkout.tsx     ← Renders duty breakdown at checkout
  prisma/
    schema.prisma          ← Session + ShopSettings tables (SQLite)
```

## How it works

1. Merchant installs the app → OAuth flow stores session in SQLite
2. Merchant enters their ClearCost API key in the admin settings page
3. At checkout, when a customer enters a shipping address, the extension detects cross-border orders
4. Extension calls `/apps/clearcost/quote` (Shopify app proxy)
5. Proxy route looks up the merchant's API key, forwards the request to the ClearCost API
6. The duty/VAT/fees breakdown is shown in the checkout UI

## Setup

### 1. Prerequisites

- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [Shopify Partners account](https://partners.shopify.com/)
- A ClearCost API key

### 2. Create the app in Shopify Partners

1. Go to **Apps** in your Partners dashboard
2. Click **Create app** → **Create app manually**
3. Copy the **Client ID** and **Client Secret**

### 3. Configure environment

```bash
cd apps/shopify
cp .env.example .env
```

Fill in your `.env`:

```
SHOPIFY_API_KEY=your_client_id
SHOPIFY_API_SECRET=your_client_secret
CLEARCOST_API_URL=https://api.clearcost.dev
```

### 4. Install dependencies and set up database

```bash
cd apps/shopify
npm install
npm run setup    # generates Prisma client + runs migrations
```

### 5. Start development

```bash
cd apps/shopify
npm run dev
```

This starts the Shopify CLI dev server with:

- Remix app with hot reload
- Checkout extension preview
- Cloudflare tunnel for OAuth callbacks

### 6. Configure product metafields

Add these metafields to your Shopify products (Admin → Products → Product → Metafields):

| Namespace | Key                   | Type   | Description                         |
| --------- | --------------------- | ------ | ----------------------------------- |
| `custom`  | `clearcost_hs6`       | string | HS6 tariff code (e.g. `850440`)     |
| `custom`  | `clearcost_origin`    | string | Origin country override (e.g. `CN`) |
| `custom`  | `clearcost_weight_kg` | string | Weight in kg (e.g. `1.2`)           |
| `custom`  | `clearcost_dims_cm`   | json   | Dimensions `{"l":20,"w":15,"h":10}` |
| `custom`  | `clearcost_category`  | string | Category key (e.g. `general`)       |

All metafields are optional — sensible defaults are used when missing.

### 7. Deploy

```bash
cd apps/shopify
npm run deploy
```

## Extension behavior

- **Domestic orders:** Extension is hidden (no duties for same-country shipments)
- **Unsupported lanes:** Extension is hidden (API returns 422 for unsupported routes)
- **API errors:** Shows a non-blocking warning banner
- **Loading:** Shows skeleton loading state while fetching

## GDPR compliance

The app handles all three mandatory Shopify GDPR webhooks:

- `customers/data_request` — ClearCost stores no customer PII, responds with 200
- `customers/redact` — No customer data to delete, responds with 200
- `shop/redact` — Deletes the shop's settings (API key, origin country)

## App proxy

The checkout extension communicates with ClearCost through Shopify's app proxy:

```
Extension → /apps/clearcost/quote → Shopify Proxy → Remix route → ClearCost API
```

The proxy route (`apps.clearcost.quote.tsx`) authenticates the request, looks up the merchant's API key from the database, and forwards the quote request to the ClearCost API.
