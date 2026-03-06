import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';

import prisma from '~/db.server';
import { authenticate } from '~/shopify.server';

/**
 * App Proxy route — receives POST requests from the checkout UI extension
 * via Shopify's app proxy (e.g. /apps/clearcost/quote).
 *
 * Flow:
 *   Checkout Extension → Shopify Proxy → this route → ClearCost API
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session?.shop) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings?.apiKey) {
    return json(
      { error: 'ClearCost API key not configured. Please configure it in the app settings.' },
      { status: 422 }
    );
  }

  try {
    const body = await request.json();

    const apiBase = process.env.CLEARCOST_API_URL || 'https://api.clearcost.dev';
    const response = await fetch(`${apiBase}/v1/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
      },
      body: JSON.stringify({
        origin: settings.originCountry,
        dest: body.dest,
        items: body.items,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return json(
        { error: data.message || 'ClearCost API error', status: response.status },
        { status: response.status }
      );
    }

    return json(data);
  } catch (error) {
    console.error('[ClearCost proxy] Error forwarding quote request:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
