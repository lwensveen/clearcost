'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/quotes', label: 'Quotes' },
  { href: '/dashboard/manifests', label: 'Manifests' },
  { href: '/dashboard/api-keys', label: 'API keys' },
  { href: '/dashboard/usage', label: 'Usage' },
  { href: '/dashboard/settings', label: 'Settings' },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const b = document.body;
    const prev = b.style.overflow;
    b.style.overflow = open ? 'hidden' : prev || '';
    return () => {
      b.style.overflow = prev || '';
    };
  }, [open]);

  return (
    <nav className="text-sm">
      <button
        className="mb-3 inline-flex w-full items-center justify-between rounded-md border px-3 py-2 md:hidden"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-controls="dash-side-nav"
      >
        Menu
        <span className="text-xs text-muted-foreground">{open ? 'Close' : 'Open'}</span>
      </button>

      <ul
        id="dash-side-nav"
        className={`space-y-1 ${open ? 'block' : 'hidden'} md:block`}
        onClick={() => setOpen(false)}
      >
        {NAV.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className={`block rounded-md px-2 py-1 transition-colors ${
                isActive(pathname, it.href)
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
