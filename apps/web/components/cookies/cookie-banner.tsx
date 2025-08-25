'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const COOKIE_NAME = 'consent-v1';
const MAX_AGE = 60 * 60 * 24 * 180;

type Consent = {
  v: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

function setConsentCookie(consent: Consent) {
  const value = encodeURIComponent(JSON.stringify(consent));
  const secure = typeof window !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  // Optional: allow listeners to react (e.g., load analytics)
  window.dispatchEvent(new Event('consentchange'));
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  function acceptAll() {
    setConsentCookie({ v: 1, necessary: true, analytics: true, marketing: true });
    hide();
  }
  function rejectAll() {
    setConsentCookie({ v: 1, necessary: true, analytics: false, marketing: false });
    hide();
  }
  function savePrefs() {
    setConsentCookie({ v: 1, necessary: true, analytics, marketing });
    hide();
  }
  function hide() {
    const el = document.getElementById('cookie-banner');
    if (el) el.style.display = 'none';
  }

  return (
    <>
      <div
        id="cookie-banner"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-700">
            We use essential cookies to run the site. With your consent, we’ll also use analytics
            and marketing cookies. See our{' '}
            <Link href="/privacy#cookies" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => setOpen(true)}>
              Preferences
            </Button>
            <Button variant="secondary" onClick={rejectAll}>
              Reject
            </Button>
            <Button onClick={acceptAll}>Accept all</Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Control optional cookies. Essential cookies are always on to keep the site working.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="block">Essential</Label>
                <p className="mt-1 text-xs text-slate-500">
                  Required for basic functionality (login, security). Always on.
                </p>
              </div>
              <Switch checked disabled />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="block">Analytics</Label>
                <p className="mt-1 text-xs text-slate-500">
                  Helps us understand usage to improve the product.
                </p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="block">Marketing</Label>
                <p className="mt-1 text-xs text-slate-500">
                  Personalization and marketing measurement.
                </p>
              </div>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={rejectAll}>
              Reject non-essential
            </Button>
            <Button onClick={savePrefs}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
