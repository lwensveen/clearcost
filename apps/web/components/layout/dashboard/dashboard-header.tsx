import Link from 'next/link';

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" className="font-heading text-lg font-semibold tracking-tight">
          ClearCost
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/docs"
            className="hidden md:inline text-muted-foreground hover:text-foreground"
          >
            Docs
          </Link>

          <Link href="/dashboard/quotes/new" className="rounded-md border px-3 py-1 hover:bg-muted">
            New quote
          </Link>
          <Link
            href="/dashboard/manifests/new"
            className="rounded-md border px-3 py-1 hover:bg-muted"
          >
            New manifest
          </Link>

          <form action="/api/auth/signout" method="post">
            <button className="rounded-md px-3 py-1 hover:bg-muted">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
