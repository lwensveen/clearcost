import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 space-y-10">
      <section>
        <h1 className="text-3xl font-semibold">Developer docs</h1>
        <p className="mt-2 text-muted-foreground">
          Quick start for the REST API and widget. Generate an API key in your dashboard.
        </p>
        <div className="mt-4">
          <Button asChild>
            <Link href="/admin/api-keys">Get API key</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-medium">Create a quote (REST)</h2>
            <pre className="mt-3 rounded-md bg-card text-card-foreground border border-border p-4 text-sm overflow-x-auto">{`POST /v1/quotes
Authorization: Bearer ck_***
Idempotency-Key: ck_idem_...

{
  "origin": "JP",
  "dest": "US",
  "itemValue": { "amount": 120, "currency": "USD" },
  "dimsCm": { "l": 30, "w": 20, "h": 15 },
  "weightKg": 2.3,
  "categoryKey": "collectibles.figure",
  "mode": "air"
}`}</pre>
            <p className="mt-3 text-sm text-muted-foreground">
              Always send <code>Idempotency-Key</code>; repeats return the cached result.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-medium">Embed the widget</h2>
            <pre className="mt-3 rounded-md bg-card text-card-foreground border border-border p-4 text-sm overflow-x-auto">{`<script src="/static/clearcost/widget.iife.js"></script>
<script>
  ClearCostWidget.mountAll({ proxyUrl: '/api/clearcost/quote', auto: true });
</script>

<div data-clearcost
     data-origin="JP" data-dest="US"
     data-price="129" data-currency="USD"
     data-l="30" data-w="20" data-h="15"
     data-weight="2.3" data-mode="air"
     data-category-key="collectibles.figure"></div>`}</pre>
            <p className="mt-3 text-sm text-muted-foreground">
              Use a server <em>proxy</em> so your API key never touches the browser.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium">Libraries</h2>
        <ul className="mt-2 list-disc pl-6 text-sm text-muted-foreground">
          <li>
            <code>@clearcost/sdk</code> — server-side SDK
          </li>
          <li>
            <code>@clearcost/widget</code> — embeddable checkout widget
          </li>
        </ul>
      </section>
    </main>
  );
}
