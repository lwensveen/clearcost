import { and, eq } from 'drizzle-orm';
import { db, webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';
import crypto from 'node:crypto';
import { decryptSecret } from './secret-kms.js';
import { httpFetch } from '../../../lib/http.js';
import { assertPublicUrl } from '../../../lib/network.js';

type EventName = 'quote.created';
type Payload = Record<string, unknown>;

const TIMEOUT_MS = Number(process.env.CLEARCOST_WEBHOOK_TIMEOUT_MS ?? 5000);
const MAX_ATTEMPTS = 3;

function sign(secret: string, body: string, ts: number) {
  const h = crypto.createHmac('sha256', secret);
  h.update(`${ts}.${body}`);
  return h.digest('hex');
}

export async function emitWebhook(ownerId: string, event: EventName, payload: Payload) {
  const endpoints = await db
    .select({
      id: webhookEndpointsTable.id,
      url: webhookEndpointsTable.url,
      events: webhookEndpointsTable.events,
      secretEnc: webhookEndpointsTable.secretEnc,
      secretIv: webhookEndpointsTable.secretIv,
      secretTag: webhookEndpointsTable.secretTag,
    })
    .from(webhookEndpointsTable)
    .where(
      and(eq(webhookEndpointsTable.ownerId, ownerId), eq(webhookEndpointsTable.isActive, true))
    );

  const body = JSON.stringify({ type: event, data: payload });
  const now = new Date();

  const matching = endpoints.filter((ep) => {
    const acceptsAll = !ep.events?.length;
    return acceptsAll || ep.events.includes(event);
  });

  // Process all matching endpoints in parallel — each endpoint's delivery
  // creation and dispatch is independent of the others.
  await Promise.allSettled(
    matching.map(async (ep) => {
      // Create delivery record
      const [delivery] = await db
        .insert(webhookDeliveriesTable)
        .values({
          endpointId: ep.id,
          event,
          payload: { type: event, data: payload },
          attempt: 0,
          status: 'pending',
          nextAttemptAt: now,
        })
        .returning({ id: webhookDeliveriesTable.id });

      if (!delivery) throw new Error('Failed to create delivery');

      // Decrypt per-endpoint; if it fails, mark as failed immediately
      let secret: string;
      try {
        secret = decryptSecret(ep.secretEnc, ep.secretIv, ep.secretTag);
      } catch (e: unknown) {
        await db
          .update(webhookDeliveriesTable)
          .set({
            attempt: 1,
            status: 'failed',
            responseStatus: 0,
            responseBody:
              `secret decrypt error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 4000),
            deliveredAt: null,
            updatedAt: new Date(),
            nextAttemptAt: null,
          })
          .where(eq(webhookDeliveriesTable.id, delivery.id));
        return;
      }

      // Fire-and-forget in production; await in tests for determinism
      if (process.env.NODE_ENV === 'test') {
        await sendAttempt(ep.id, ep.url, secret, delivery.id, body);
      } else {
        sendAttempt(ep.id, ep.url, secret, delivery.id, body).catch(() => {
          /* delivery status is persisted inside sendAttempt; swallow to avoid unhandled rejection */
        });
      }
    })
  );
}

async function sendAttempt(
  endpointId: string,
  url: string,
  secret: string,
  deliveryId: string,
  body: string
) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = sign(secret, body, ts);

  // SSRF protection: resolve hostname and reject private/internal IPs
  await assertPublicUrl(url);

  let status = 0;
  let text = '';
  try {
    const r = await httpFetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'ClearCost-Webhooks/1.0',
        'clearcost-signature': `t=${ts},v1=${sig}`,
      },
      body,
      timeoutMs: TIMEOUT_MS,
    });
    status = r.status;
    text = await r.text();
  } catch (e: unknown) {
    status = 0;
    text = e instanceof Error ? e.message : String(e);
  }

  const [curr] = await db
    .select({
      attempt: webhookDeliveriesTable.attempt,
      status: webhookDeliveriesTable.status,
    })
    .from(webhookDeliveriesTable)
    .where(eq(webhookDeliveriesTable.id, deliveryId))
    .limit(1);

  const attempt = (curr?.attempt ?? 0) + 1;
  const ok = status >= 200 && status < 300;

  if (ok) {
    await db
      .update(webhookDeliveriesTable)
      .set({
        attempt,
        status: 'success',
        responseStatus: status,
        responseBody: text.slice(0, 4000),
        deliveredAt: new Date(),
        updatedAt: new Date(),
        nextAttemptAt: null,
      })
      .where(eq(webhookDeliveriesTable.id, deliveryId));
    return;
  }

  const shouldRetry = attempt < MAX_ATTEMPTS;
  const backoffMin = attempt === 1 ? 1 : attempt === 2 ? 5 : 30;
  const next = shouldRetry ? new Date(Date.now() + backoffMin * 60_000) : null;

  await db
    .update(webhookDeliveriesTable)
    .set({
      attempt,
      status: shouldRetry ? 'pending' : 'failed',
      responseStatus: status,
      responseBody: text.slice(0, 4000),
      nextAttemptAt: next,
      updatedAt: new Date(),
    })
    .where(eq(webhookDeliveriesTable.id, deliveryId));

  if (shouldRetry && next) {
    setTimeout(
      () =>
        sendAttempt(endpointId, url, secret, deliveryId, body).catch(() => {
          /* delivery status is persisted inside sendAttempt; swallow to avoid unhandled rejection */
        }),
      backoffMin * 60_000
    );
  }
}
