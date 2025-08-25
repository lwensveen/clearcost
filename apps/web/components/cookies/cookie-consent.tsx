import { cookies } from 'next/headers';
import { CookieBanner } from './cookie-banner';

export const COOKIE_NAME = 'consent-v1';

export default async function CookieConsent() {
  const consent = (await cookies()).get(COOKIE_NAME)?.value;

  if (consent) return null;

  return <CookieBanner />;
}
