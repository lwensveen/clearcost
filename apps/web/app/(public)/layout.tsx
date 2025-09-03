import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import CookieConsent from '@/components/cookies/cookie-consent';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-64px)]">{children}</main>
      <Footer />
      <CookieConsent />
    </>
  );
}
