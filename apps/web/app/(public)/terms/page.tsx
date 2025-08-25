import type { Metadata } from 'next';

import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Terms of Service — ClearCost',
  description: 'ClearCost Terms of Service',
};

const LAST_UPDATED = new Date().toISOString().slice(0, 10);

export default function TermsPage() {
  return (
    <>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[240px_1fr]">
          <aside className="hidden md:block sticky top-20 self-start">
            <div className="text-sm font-medium mb-3">On this page</div>
            <nav className="space-y-1 text-sm">
              {[
                ['intro', '1. Introduction'],
                ['accounts', '2. Accounts & API Keys'],
                ['acceptable-use', '3. Acceptable Use'],
                ['availability', '4. Availability & Changes'],
                ['disclaimers', '5. Disclaimers & Liability'],
                ['law', '6. Governing Law'],
                ['contact', '7. Contact'],
              ].map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <Card>
            <CardContent className="p-6 md:p-8">
              <div className="space-y-8">
                <section id="intro" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">1. Introduction</h2>
                  <p className="text-base leading-7 text-foreground/90">
                    These Terms govern your access to and use of ClearCost’s services, APIs, and
                    software. By using ClearCost, you agree to these Terms.
                  </p>
                </section>

                <section id="accounts" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">
                    2. Accounts &amp; API Keys
                  </h2>
                  <p className="text-base leading-7 text-foreground/90">
                    You’re responsible for safeguarding API keys and for all activity under your
                    account. Abuse, fraud, or excessive load may result in rate limiting or
                    suspension.
                  </p>
                </section>

                <section id="acceptable-use" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">3. Acceptable Use</h2>
                  <ul className="list-disc pl-5 space-y-1 text-base leading-7 text-foreground/90">
                    <li>No reverse engineering, scraping, or misuse of returned data.</li>
                    <li>Respect applicable import/export and data protection laws.</li>
                  </ul>
                </section>

                <section id="availability" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">
                    4. Availability &amp; Changes
                  </h2>
                  <p className="text-base leading-7 text-foreground/90">
                    We may update or discontinue features. We’ll try to provide reasonable notice of
                    material changes.
                  </p>
                </section>

                <section id="disclaimers" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">
                    5. Disclaimers &amp; Limitation of Liability
                  </h2>
                  <p className="text-base leading-7 text-foreground/90">
                    Services are provided “as is” without warranties. We are not liable for indirect
                    or consequential damages.
                  </p>
                </section>

                <section id="law" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">6. Governing Law</h2>
                  <p className="text-base leading-7 text-foreground/90">
                    Specify your governing law/jurisdiction here.
                  </p>
                </section>

                <section id="contact" className="space-y-3 scroll-mt-24">
                  <h2 className="font-heading text-2xl font-semibold">7. Contact</h2>
                  <p className="text-base leading-7 text-foreground/90">
                    Questions?{' '}
                    <a className="underline" href="mailto:legal@clearcost.dev">
                      legal@clearcost.dev
                    </a>
                  </p>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
