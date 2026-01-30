import { headers } from 'next/headers';
import { getAuth } from '@/auth';
import Link from 'next/link';
import { AdminHeader } from '@/components/layout/admin-header';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = getAuth();
  await auth.api.getSession({ headers: await headers() });
  // if (!session) redirect('/login');

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:h-[calc(100dvh-5rem)] md:py-2">
            <nav className="text-sm">
              <ul className="space-y-1">
                <li>
                  <Link className="block rounded-md px-2 py-1 hover:bg-muted" href="/admin">
                    Overview
                  </Link>
                </li>
                <li>
                  <Link
                    className="block rounded-md px-2 py-1 hover:bg-muted"
                    href="/admin/manifests"
                  >
                    Manifests
                  </Link>
                </li>
                <li>
                  <Link className="block rounded-md px-2 py-1 hover:bg-muted" href="/admin/billing">
                    Billing
                  </Link>
                </li>
                <li>
                  <Link className="block rounded-md px-2 py-1 hover:bg-muted" href="/admin/imports">
                    Imports
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          <section>{children}</section>
        </div>
      </main>
    </>
  );
}
