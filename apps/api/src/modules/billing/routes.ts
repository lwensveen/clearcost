import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import rawBodyPlugin from 'fastify-raw-body';
import { z } from 'zod/v4';
import { billingAccountsTable, db } from '@clearcost/db';
import { eq } from 'drizzle-orm';
import { errorResponseForStatus } from '../../lib/errors.js';
import {
  BillingCheckoutBodySchema,
  BillingCheckoutResponseSchema,
  BillingComputeUsageResponseSchema,
  BillingEntitlementsResponseSchema,
  BillingPlanResponseSchema,
  BillingPortalBodySchema,
  BillingPortalResponseSchema,
  BillingWebhookResponseSchema,
  ErrorResponseSchema,
} from '@clearcost/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-01-28.clover',
});

const PRICE: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  growth: process.env.STRIPE_PRICE_GROWTH || '',
  scale: process.env.STRIPE_PRICE_SCALE || '',
};

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const unix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub as unknown as { currentPeriodEnd?: number }).currentPeriodEnd ??
    null;
  return typeof unix === 'number' ? new Date(unix * 1000) : null;
}

async function ensureBillingAccount(ownerId: string) {
  const [row] = await db
    .select()
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.ownerId, ownerId))
    .limit(1);
  if (row) return row;

  await db.insert(billingAccountsTable).values({ ownerId, plan: 'free', status: 'free' });
  return { ownerId, plan: 'free', status: 'free' } as any;
}

export default async function billingRoutes(app: FastifyInstance) {
  // Create Checkout session (subscription)
  app.post<{
    Body: z.infer<typeof BillingCheckoutBodySchema>;
    Reply: z.infer<typeof BillingCheckoutResponseSchema> | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/checkout',
    {
      preHandler: app.requireApiKey(['billing:write']),
      schema: {
        body: BillingCheckoutBodySchema,
        response: {
          200: BillingCheckoutResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;
      const { plan, returnUrl } = req.body;

      if (!PRICE[plan])
        return reply.code(400).send(errorResponseForStatus(400, 'Price not configured'));

      const account = await ensureBillingAccount(ownerId);

      // Ensure Stripe Customer
      let customerId = account.stripeCustomerId;
      if (!customerId) {
        const c = await stripe.customers.create({ metadata: { ownerId } });
        customerId = c.id;
        await db
          .insert(billingAccountsTable)
          .values({ ownerId, stripeCustomerId: customerId })
          .onConflictDoUpdate({
            target: billingAccountsTable.ownerId,
            set: { stripeCustomerId: customerId },
          });
      }

      const success =
        returnUrl ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000/admin/billing?success=1';
      const cancel =
        returnUrl ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000/admin/billing?canceled=1';

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: PRICE[plan], quantity: 1 }],
        success_url: success,
        cancel_url: cancel,
        metadata: { ownerId, plan },
        client_reference_id: ownerId,
        allow_promotion_codes: true,
      });

      return reply.send({ url: session.url! });
    }
  );

  // Billing Portal
  app.post<{
    Body: z.infer<typeof BillingPortalBodySchema> | undefined;
    Reply: z.infer<typeof BillingPortalResponseSchema> | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/portal',
    {
      preHandler: app.requireApiKey(['billing:write']),
      schema: {
        body: BillingPortalBodySchema.optional(),
        response: {
          200: BillingPortalResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;
      const account = await ensureBillingAccount(ownerId);
      if (!account.stripeCustomerId)
        return reply.code(400).send(errorResponseForStatus(400, 'No Stripe customer'));

      const returnUrl =
        req.body?.returnUrl ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000/admin/billing';

      const portal = await stripe.billingPortal.sessions.create({
        customer: account.stripeCustomerId,
        return_url: returnUrl,
      });
      return reply.send({ url: portal.url });
    }
  );

  // Get current plan
  app.get(
    '/plan',
    {
      preHandler: app.requireApiKey(['billing:read']),
      schema: {
        response: {
          200: BillingPlanResponseSchema,
        },
      },
    },
    async (req) => {
      const ownerId = req.apiKey!.ownerId;
      const row = await ensureBillingAccount(ownerId);
      return {
        plan: row.plan ?? 'free',
        status: row.status ?? null,
        priceId: row.priceId ?? null,
        currentPeriodEnd: row.currentPeriodEnd ?? null,
      };
    }
  );

  // Webhook (Stripe → us). Needs raw body for signature verification.
  await app.register(rawBodyPlugin, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });

  app.post<{
    Reply: z.infer<typeof BillingWebhookResponseSchema> | z.infer<typeof ErrorResponseSchema>;
  }>(
    '/webhook/stripe',
    {
      config: { rawBody: true },
      schema: { response: { 200: BillingWebhookResponseSchema, 400: ErrorResponseSchema } },
    },
    async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string | undefined;
      const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!sig || !whSecret) {
        return reply.code(400).send(errorResponseForStatus(400, 'Missing signature or secret'));
      }

      let event: Stripe.Event;
      try {
        const raw = req.rawBody as string;
        event = stripe.webhooks.constructEvent(raw, sig, whSecret);
      } catch (err: any) {
        req.log.error({ err }, 'stripe_webhook_verify_failed');
        return reply.code(400).send(errorResponseForStatus(400, `Webhook Error: ${err.message}`));
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const s = event.data.object as Stripe.Checkout.Session;
            const ownerId = (s.metadata?.ownerId as string) || (s.client_reference_id as string);
            if (ownerId && s.subscription) {
              const subResp = await stripe.subscriptions.retrieve(
                typeof s.subscription === 'string' ? s.subscription : s.subscription.id
              );

              // Narrow: treat the response as Subscription to access snake_case fields safely
              const sub = subResp as unknown as Stripe.Subscription;

              const priceId = sub.items.data[0]?.price.id || null;
              const planFromPrice =
                priceId === PRICE.scale
                  ? 'scale'
                  : priceId === PRICE.growth
                    ? 'growth'
                    : priceId === PRICE.starter
                      ? 'starter'
                      : 'unknown';

              await db
                .insert(billingAccountsTable)
                .values({
                  ownerId,
                  stripeCustomerId: String(s.customer),
                  plan: planFromPrice,
                  status: sub.status,
                  priceId: priceId ?? null,
                  currentPeriodEnd: subscriptionPeriodEnd(sub),
                })
                .onConflictDoUpdate({
                  target: billingAccountsTable.ownerId,
                  set: {
                    stripeCustomerId: String(s.customer),
                    plan: planFromPrice,
                    status: sub.status,
                    priceId: priceId ?? null,
                    currentPeriodEnd: subscriptionPeriodEnd(sub),
                  },
                });
            }
            break;
          }

          case 'customer.subscription.updated':
          case 'customer.subscription.created':
          case 'customer.subscription.deleted': {
            // As above, narrow to Subscription for snake_case fields
            const sub = event.data.object as Stripe.Subscription;
            const customerId = String(sub.customer);

            const [row] = await db
              .select()
              .from(billingAccountsTable)
              .where(eq(billingAccountsTable.stripeCustomerId, customerId))
              .limit(1);

            if (row) {
              const priceId = sub.items.data[0]?.price.id ?? null;
              const planFromPrice =
                priceId === PRICE.scale
                  ? 'scale'
                  : priceId === PRICE.growth
                    ? 'growth'
                    : priceId === PRICE.starter
                      ? 'starter'
                      : (row.plan ?? 'free');

              await db
                .update(billingAccountsTable)
                .set({
                  plan: planFromPrice,
                  status: sub.status,
                  priceId,
                  currentPeriodEnd: subscriptionPeriodEnd(sub),
                  updatedAt: new Date(),
                })
                .where(eq(billingAccountsTable.ownerId, row.ownerId));
            }
            break;
          }

          default:
            // ignore others
            break;
        }
      } catch (err: any) {
        req.log.error({ err, type: event.type }, 'stripe_webhook_handle_failed');
        // Still 200 to avoid repeated retries from Stripe. Adjust if desired.
      }

      return reply.send({ received: true });
    }
  );

  app.get(
    '/entitlements',
    {
      preHandler: app.requireApiKey(['billing:read']),
      schema: {
        response: {
          200: BillingEntitlementsResponseSchema,
        },
      },
    },
    async (req) => {
      const ownerId = req.apiKey!.ownerId;
      const { plan, maxManifests, maxItemsPerManifest } =
        await req.server.entitlements.getLimitsForOwner(ownerId);
      return { plan, maxManifests, maxItemsPerManifest };
    }
  );

  app.get(
    '/compute-usage',
    {
      preHandler: app.requireApiKey(['billing:read']),
      schema: {
        response: {
          200: BillingComputeUsageResponseSchema,
        },
      },
    },
    async (req) => {
      const { allowed, plan, limit, used } = await req.server.enforceComputeLimit(req);
      return { allowed, plan, limit, used };
    }
  );
}
