'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function TokenToast({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    toast('API key created', {
      description: 'Copied to clipboard. You won’t see it again.',
    });
    try {
      navigator.clipboard?.writeText(token);
    } catch {}
  }, [token]);

  return null;
}
