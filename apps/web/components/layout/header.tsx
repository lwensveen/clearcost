'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/toggle';

export function Header() {
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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="ClearCost home">
          <span className="font-heading text-lg md:text-xl font-semibold tracking-tight">
            ClearCost
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex text-sm">
          <Link href="/#features" className="text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link href="/#how-it-works" className="text-muted-foreground hover:text-foreground">
            How it works
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/docs" className="text-muted-foreground hover:text-foreground">
            Docs
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>

        <button
          className="inline-flex items-center justify-center md:hidden rounded-md border px-2 py-1 text-sm"
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="md:hidden border-t">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            <Link href="/#features" onClick={() => setOpen(false)} className="py-1">
              Features
            </Link>
            <Link href="/#how-it-works" onClick={() => setOpen(false)} className="py-1">
              How it works
            </Link>
            <Link href="/pricing" onClick={() => setOpen(false)} className="py-1">
              Pricing
            </Link>
            <Link href="/docs" onClick={() => setOpen(false)} className="py-1">
              Docs
            </Link>
            <div className="pt-2 flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="w-full" onClick={() => setOpen(false)}>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
