import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import rawBodyPlugin from 'fastify-raw-body';
import { z } from 'zod/v4';
import { billingAccountsTable, db } from '@clearcost/db';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-08-27.basil',
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
    Body: { plan: 'starter' | 'growth' | 'scale'; returnUrl?: string };
    Reply: { url: string } | { error: string };
  }>(
    '/v1/billing/checkout',
    {
      preHandler: app.requireApiKey(['billing:write']),
      schema: {
        body: z.object({
          plan: z.enum(['starter', 'growth', 'scale']),
          returnUrl: z.string().url().optional(),
        }),
        response: {
          200: z.object({ url: z.string().url() }),
          400: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;
      const { plan, returnUrl } = req.body;

      if (!PRICE[plan]) return reply.badRequest('Price not configured');

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
    Body: { returnUrl?: string };
    Reply: { url: string } | { error: string };
  }>(
    '/v1/billing/portal',
    {
      preHandler: app.requireApiKey(['billing:write']),
      schema: {
        body: z.object({ returnUrl: z.string().url().optional() }).optional(),
        response: {
          200: z.object({ url: z.string().url() }),
          400: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;
      const account = await ensureBillingAccount(ownerId);
      if (!account.stripeCustomerId) return reply.badRequest('No Stripe customer');

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
    '/v1/billing/plan',
    {
      preHandler: app.requireApiKey(['billing:read']),
      schema: {
        response: {
          200: z.object({
            plan: z.string(),
            status: z.string().nullable(),
            priceId: z.string().nullable().optional(),
            currentPeriodEnd: z.date().nullable().optional(),
          }),
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
    Reply: { received: true } | { error: string };
  }>(
    '/v1/billing/webhook/stripe',
    {
      config: { rawBody: true },
    },
    async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string | undefined;
      const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!sig || !whSecret) {
        return reply.code(400).send({ error: 'Missing signature or secret' });
      }

      let event: Stripe.Event;
      try {
        const raw = req.rawBody as string;
        event = stripe.webhooks.constructEvent(raw, sig, whSecret);
      } catch (err: any) {
        req.log.error({ err }, 'stripe_webhook_verify_failed');
        return reply.code(400).send({ error: `Webhook Error: ${err.message}` });
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
          200: z.object({
            plan: z.string(),
            maxManifests: z.number(),
            maxItemsPerManifest: z.number(),
          }),
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
    '/v1/billing/compute-usage',
    {
      preHandler: app.requireApiKey(['billing:read']),
      schema: {
        response: {
          200: z.object({
            allowed: z.boolean(),
            plan: z.string(),
            limit: z.number().int(),
            used: z.number().int(),
          }),
        },
      },
    },
    async (req) => {
      const { allowed, plan, limit, used } = await req.server.enforceComputeLimit(req);
      return { allowed, plan, limit, used };
    }
  );
}
