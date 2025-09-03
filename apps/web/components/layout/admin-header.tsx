import Link from 'next/link';

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-amber-50/80 backdrop-blur supports-[backdrop-filter]:bg-amber-50/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/admin" className="font-semibold tracking-tight">
          Clearcost Admin
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="hover:underline" href="/admin">
            Overview
          </Link>
          <Link className="hover:underline" href="/admin/manifests">
            Manifests
          </Link>
          <Link className="hover:underline" href="/admin/billing">
            Billing
          </Link>
          <Link className="hover:underline" href="/admin/imports">
            Imports
          </Link>
        </nav>
      </div>
    </header>
  );
}
