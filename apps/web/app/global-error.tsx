'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body>
        <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center p-6 text-center">
          <div>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-3 text-slate-600">Please try again, or return to the homepage.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" asChild>
                <Link href="/">Go home</Link>
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
