import { headers } from 'next/headers';
import { getAuth } from '@/auth';
import { DashboardHeader } from '@/components/layout/dashboard/dashboard-header';
import { DashboardNav } from '@/components/layout/dashboard/dashboard-nav';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = getAuth();
  await auth.api.getSession({ headers: await headers() });
  // if (!session) redirect('/login');

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:h-[calc(100dvh-5rem)] md:py-2">
            <DashboardNav />
          </aside>
          <section className="min-h-[60vh]">{children}</section>
        </div>
      </main>
    </>
  );
}
