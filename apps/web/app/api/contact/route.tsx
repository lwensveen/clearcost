import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const fd = await req.formData();

  if ((fd.get('company') as string | null)?.trim()) {
    return NextResponse.redirect(new URL('/contact?sent=1', req.url), 303);
  }

  const name = String(fd.get('name') ?? '').slice(0, 200);
  const email = String(fd.get('email') ?? '').slice(0, 200);
  const message = String(fd.get('message') ?? '').slice(0, 5000);

  const payload = {
    source: 'clearcost-web',
    name,
    email,
    message,
    at: new Date().toISOString(),
  };

  // Optional: post to a webhook if provided (Slack, Discord, etc.)
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore—still redirect with success to keep UX smooth
    }
  } else {
    console.log('Contact form (no webhook configured):', payload);
  }

  return NextResponse.redirect(new URL('/contact?sent=1', req.url), 303);
}
