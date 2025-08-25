'use client';

import { useMemo, useSyncExternalStore } from 'react';

const COOKIE_NAME = 'consent-v1';
type Consent = { v: 1; necessary: true; analytics: boolean; marketing: boolean };

function readConsent(): Consent | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]!)) as Consent;
  } catch {
    return null;
  }
}

// Subscribe to `consentchange` to update gates without reload
function subscribe(callback: () => void) {
  window.addEventListener('consentchange', callback);
  return () => window.removeEventListener('consentchange', callback);
}
function getSnapshot() {
  return Math.random(); // force re-eval; we only need a tick on event
}

export function ConsentGate({
  when,
  children,
}: {
  when: 'analytics' | 'marketing';
  children: React.ReactNode;
}) {
  // Re-render on consentchange
  useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const allowed = useMemo(() => {
    const c = typeof document !== 'undefined' ? readConsent() : null;
    return !!c && c[when];
  }, [when]);

  if (!allowed) return null;
  return <>{children}</>;
}
