import type { ActionFunctionArgs } from '@remix-run/node';

import prisma from '~/db.server';
import { authenticate } from '~/shopify.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  switch (topic) {
    case 'APP_UNINSTALLED':
      // Clean up shop data when the app is uninstalled
      await prisma.shopSettings.deleteMany({ where: { shop } });
      break;

    case 'CUSTOMERS_DATA_REQUEST':
      // Shopify GDPR: a customer requested their data.
      // ClearCost does not store personal customer data — nothing to return.
      break;

    case 'CUSTOMERS_REDACT':
      // Shopify GDPR: a customer requested deletion of their data.
      // ClearCost does not store personal customer data — nothing to delete.
      break;

    case 'SHOP_REDACT':
      // Shopify GDPR: the shop owner requested deletion of all shop data.
      await prisma.shopSettings.deleteMany({ where: { shop } });
      break;

    default:
      throw new Response('Unhandled webhook topic', { status: 404 });
  }

  return new Response(null, { status: 200 });
};
