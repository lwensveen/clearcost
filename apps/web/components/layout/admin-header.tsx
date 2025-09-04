'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/toggle';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/manifests', label: 'Manifests' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/imports', label: 'Imports' },
];

export function AdminHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const { body } = document;
    if (!body) return;
    const prev = body.style.overflow;
    body.style.overflow = open ? 'hidden' : prev || '';
    return () => {
      body.style.overflow = prev || '';
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-amber-50/80 backdrop-blur supports-[backdrop-filter]:bg-amber-50/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/admin" className="flex items-center gap-2" aria-label="ClearCost Admin">
          <span className="font-heading text-lg md:text-xl font-semibold tracking-tight">
            ClearCost Admin
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex text-sm">
          {NAV.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={
                isActive(it.href)
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }
            >
              {it.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/dashboard">User dashboard</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/docs">Docs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/logout">Sign out</Link>
          </Button>
        </div>

        <button
          className="inline-flex items-center justify-center md:hidden rounded-md border px-2 py-1 text-sm"
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div id="admin-mobile-nav" className="md:hidden border-t">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            {NAV.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={
                  isActive(it.href)
                    ? 'py-1 font-medium text-foreground'
                    : 'py-1 text-muted-foreground hover:text-foreground'
                }
              >
                {it.label}
              </Link>
            ))}

            <div className="pt-2 flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}>
                <Link href="/dashboard">User dashboard</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}>
                <Link href="/docs">Docs</Link>
              </Button>
              <Button asChild className="w-full" onClick={() => setOpen(false)}>
                <Link href="/logout">Sign out</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
