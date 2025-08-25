import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-2">
          <div className="font-heading text-lg font-semibold tracking-tight">ClearCost</div>
          <p className="text-sm text-muted-foreground">
            Landed-cost quotes (duty, VAT, freight) you can trust—at checkout speed.
          </p>
        </div>

        <div>
          <div className="mb-2 font-medium">Product</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/#features" className="text-muted-foreground hover:text-foreground">
                Features
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/docs" className="text-muted-foreground hover:text-foreground">
                Docs
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-2 font-medium">Developers</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/docs" className="text-muted-foreground hover:text-foreground">
                API Reference
              </Link>
            </li>
            <li>
              <Link href="/admin/api-keys" className="text-muted-foreground hover:text-foreground">
                Get API key
              </Link>
            </li>
            <li>
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-2 font-medium">Company</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/status" className="text-muted-foreground hover:text-foreground">
                Status
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@clearcost.dev"
                className="text-muted-foreground hover:text-foreground"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground md:flex-row">
          <span>© {year} ClearCost. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/status" className="hover:text-foreground">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
