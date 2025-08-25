import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Privacy Policy — ClearCost',
  description: 'How ClearCost collects and uses data',
};

const LAST_UPDATED = new Date().toISOString().slice(0, 10);

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="space-y-8">
              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Overview</h2>
                <p className="text-base leading-7 text-foreground/90">
                  This policy describes what we collect, how we use it, and your choices. We aim to
                  collect the minimum data needed to provide the service.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Data We Collect</h2>
                <ul className="list-disc pl-5 space-y-1 text-base leading-7 text-foreground/90">
                  <li>Account data (name, email) to manage access and contact you.</li>
                  <li>
                    API usage metadata (timestamps, routes, sizes) for billing/abuse prevention.
                  </li>
                  <li>Logs/metrics to operate and secure the service.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">How We Use Data</h2>
                <ul className="list-disc pl-5 space-y-1 text-base leading-7 text-foreground/90">
                  <li>Provide, maintain, and improve the service.</li>
                  <li>Authenticate, rate-limit, and prevent fraud/abuse.</li>
                  <li>Communicate about updates, security, and billing.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Sharing</h2>
                <p className="text-base leading-7 text-foreground/90">
                  We don’t sell your data. We may share with vendors (e.g., cloud, email) under
                  contracts that restrict processing to our instructions.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Security</h2>
                <p className="text-base leading-7 text-foreground/90">
                  Least-privilege access, encryption in transit, audit trails for admin actions.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Retention</h2>
                <p className="text-base leading-7 text-foreground/90">
                  We keep data as long as necessary for the purposes above and to comply with legal
                  obligations.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Your Choices</h2>
                <p className="text-base leading-7 text-foreground/90">
                  Contact us to access, correct, or delete your data where applicable by law.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-heading text-2xl font-semibold">Contact</h2>
                <p className="text-base leading-7 text-foreground/90">
                  Email{' '}
                  <a className="underline" href="mailto:privacy@clearcost.dev">
                    privacy@clearcost.dev
                  </a>
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
