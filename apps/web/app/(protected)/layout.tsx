import { headers } from 'next/headers';
import { auth } from '@/auth';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  // if (!session) {
  //   redirect('/login');
  // }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:h-[calc(100dvh-5rem)] md:py-2">
            <nav className="text-sm">
              <ul className="space-y-1">
                <li>
                  <Link className="block rounded-md px-2 py-1 hover:bg-muted" href="/dashboard">
                    Overview
                  </Link>
                </li>
                <li>
                  <Link
                    className="block rounded-md px-2 py-1 hover:bg-muted"
                    href="/dashboard/api-keys"
                  >
                    API keys
                  </Link>
                </li>
                <li>
                  <Link
                    className="block rounded-md px-2 py-1 hover:bg-muted"
                    href="/dashboard/usage"
                  >
                    Usage
                  </Link>
                </li>
                <li>
                  <Link
                    className="block rounded-md px-2 py-1 hover:bg-muted"
                    href="/dashboard/settings"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          <section>{children}</section>
        </div>
      </main>
      <Footer />
    </>
  );
}
