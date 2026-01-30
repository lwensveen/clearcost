# ClearCost Web (apps/web)

A lightweight **Next.js** app used for docs, simple dashboards, and testing the ClearCost API.

> Stack: Next.js (App Router) • React • TypeScript • Tailwind CSS • shadcn/ui • lucide-react • Bun

---

## Quick start

```bash
# from repo root (recommended)
bunx turbo run dev

# or run just the web app
cd apps/web
bun install
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000)

---

## Environment

Create `apps/web/.env.local` (not committed). Minimal variables:

```bash
# Auth/session DB
DATABASE_URL="postgres://postgres:postgres@localhost:5432/clearcost"

# Where the API lives (server-side)
CLEARCOST_API_URL="http://localhost:4000"
CLEARCOST_WEB_SERVER_KEY="ck_test_..."
CLEARCOST_ADMIN_API_KEY="ck_test_admin_..."

# Better Auth + email flows
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="super-long-random-secret"
API_URL="http://localhost:3000"
EMAIL_OTP_API_SECRET="email-otp-secret"
TURNSTILE_SECRET_KEY="turnstile-secret"

# Redis (Upstash)
REDIS_URL="https://...upstash.io"
REDIS_TOKEN="..."

# Public (client-visible)
NEXT_PUBLIC_API_BASE="http://localhost:4000"
```

**Notes**

- `NEXT_PUBLIC_*` variables are exposed to the browser. Keep secrets (API keys) **without** that prefix and use them
  only in server files (route handlers / server actions).

---

## Scripts

From `apps/web`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

Run with Bun:

```bash
bun run dev         # local dev
bun run build && bun run start
bun run lint && bun run type-check
```

---

## Project layout

```
apps/web/
  app/                      # App Router pages & route handlers
    (marketing)/            # Example segment for docs/marketing pages
    api/                    # Server-only API routes (Next Route Handlers)
    page.tsx                # Home page
    layout.tsx              # Root layout (theme, fonts, metadata)
  components/               # UI components (client/server components)
  lib/                      # Client helpers, fetchers, utilities
  public/                   # Static assets
  styles/                   # Tailwind globals (if present)
  next.config.js            # Next config
  postcss.config.js
  tailwind.config.ts
```

---

## Talking to the API

### 1) Server‑side proxy (preferred)

Create `app/api/quote/route.ts` and forward to the ClearCost API so the browser never sees your key:

```ts
// apps/web/app/api/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = await fetch(`${process.env.CLEARCOST_API_URL}/v1/quote`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.CLEARCOST_API_KEY!,
    },
    body: JSON.stringify(body),
    // Keep this server-side only
    cache: 'no-store',
  });

  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
```

Use from a client component:

```ts
const res = await fetch('/api/quote', { method: 'POST', body: JSON.stringify(input) });
const data = await res.json();
```

### 2) Direct browser calls (no secrets)

If your API allows public endpoints, point to `NEXT_PUBLIC_API_BASE`:

```ts
const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/v1/hs-codes/search?query=violin`);
```

---

## UI & styling

- **Tailwind CSS** is preconfigured. Global styles usually live in `app/globals.css`.
- **shadcn/ui** components are supported. Example import:

```tsx
import { Button } from '@/components/ui/button';
```

- **lucide-react** for icons.

---

## Type‑safety & linting

- Run `bun run type-check` to verify types.
- Run `bun run lint` to check ESLint rules.

TIP: In VS Code, enable **TypeScript: Prefer Workspace Version**.

---

## Testing (optional)

If you add tests later, keep them in `apps/web/__tests__` or `app/**/__tests__` and wire a `bun test` script.

---

## Deploy

### Vercel

1. Import the repo in Vercel, set the Project root to `apps/web`.
2. Add env vars (`NEXT_PUBLIC_API_BASE`, optionally `CLEARCOST_API_URL` & `CLEARCOST_API_KEY`).
3. Build Command (auto): `next build`.
4. Output: `.next` (default).

### Docker (basic)

```Dockerfile
# apps/web/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## Handy snippets

**Client fetcher** (`lib/fetcher.ts`):

```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
```

**Linking to docs** (if this app hosts docs): place markdown under `app/(marketing)` and render via MDX or a static
page.

---

## Troubleshooting

- **CORS errors**: use the server proxy (`app/api/*`) so requests originate from the same host.
- **404 on API**: check `NEXT_PUBLIC_API_BASE` or `CLEARCOST_API_URL` and that the backend is running.
- **Type mismatches**: ensure your `@clearcost/types` package versions align across the monorepo.

---

## License

MIT — see repo root `LICENSE`.
