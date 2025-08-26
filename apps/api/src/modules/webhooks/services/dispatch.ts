import { and, eq } from 'drizzle-orm';
import { db, webhookDeliveriesTable, webhookEndpointsTable } from '@clearcost/db';
import crypto from 'node:crypto';

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
      secret: webhookEndpointsTable.secret,
      events: webhookEndpointsTable.events,
    })
    .from(webhookEndpointsTable)
    .where(
      and(eq(webhookEndpointsTable.ownerId, ownerId), eq(webhookEndpointsTable.isActive, true))
    );

  const body = JSON.stringify({ type: event, data: payload });
  const now = new Date();

  for (const ep of endpoints) {
    const acceptsAll = !ep.events?.length;
    const acceptsEvent = acceptsAll || ep.events.includes(event);
    if (!acceptsEvent) continue;

    const deliveries = await db
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

    const delivery = deliveries[0];

    if (!delivery) throw Error('No deliveries');

    void sendAttempt(ep.id, ep.url, ep.secret, delivery.id, body);
  }
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

  let status = 0;
  let text = '';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'ClearCost-Webhooks/1.0',
        'clearcost-signature': `t=${ts},v1=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = r.status;
    text = await r.text();
  } catch (e: any) {
    status = 0;
    text = String(e?.message ?? e);
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
    // crude in-process timer; replace with  job runner later
    setTimeout(
      () => void sendAttempt(endpointId, url, secret, deliveryId, body),
      backoffMin * 60_000
    );
  }
}
