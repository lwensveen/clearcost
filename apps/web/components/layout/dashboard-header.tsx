import Link from 'next/link';

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Clearcost
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="hover:underline" href="/dashboard">
            Overview
          </Link>
          <Link className="hover:underline" href="/dashboard/api-keys">
            API keys
          </Link>
          <Link className="hover:underline" href="/dashboard/usage">
            Usage
          </Link>
          <Link className="hover:underline" href="/dashboard/settings">
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
