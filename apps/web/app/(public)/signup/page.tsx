'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh grid place-items-center p-6">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm bg-white">
            <div className="h-6 w-2/3 animate-pulse rounded bg-neutral-200" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded bg-neutral-100" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackURL = params.get('callbackUrl') ?? '/';

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '');
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    await authClient.signUp.email(
      { name, email, password, callbackURL },
      {
        onError: (ctx: { error: { message: string } }) => setError(ctx.error.message),
        onSuccess: () => router.push(callbackURL),
      }
    );

    setPending(false);
  }

  async function oauth(provider: 'google' | 'github' | 'facebook') {
    setError(null);
    await authClient.signIn.social({ provider, callbackURL });
  }

  return (
    <div className="min-h-svh grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm bg-white">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign up with OAuth or email/password.</p>

        {error && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Name</span>
            <input
              name="name"
              type="text"
              className="h-10 rounded-md border px-3 outline-none focus:ring"
              placeholder="Username"
              disabled={pending}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              className="h-10 rounded-md border px-3 outline-none focus:ring"
              placeholder="you@example.com"
              disabled={pending}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              className="h-10 rounded-md border px-3 outline-none focus:ring"
              placeholder="••••••••"
              disabled={pending}
            />
          </label>

          <button
            type="submit"
            className="mt-2 h-10 rounded-md border bg-black text-white hover:opacity-90 disabled:opacity-60"
            disabled={pending}
          >
            {pending ? 'Creating…' : 'Sign up'}
          </button>
        </form>

        <div className="mt-6 grid gap-2">
          <button
            onClick={() => oauth('google')}
            className="h-10 rounded-md border hover:bg-neutral-50"
          >
            Continue with Google
          </button>
          <button
            onClick={() => oauth('facebook')}
            className="h-10 rounded-md border hover:bg-neutral-50"
          >
            Continue with Facebook
          </button>
        </div>

        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <Link
            href={`/login${callbackURL ? `?callbackUrl=${encodeURIComponent(callbackURL)}` : ''}`}
            className="underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
