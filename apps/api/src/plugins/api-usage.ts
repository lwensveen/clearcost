import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { apiUsageTable, db } from '@clearcost/db';
import { sql } from 'drizzle-orm';

function dayStartUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Buffer + circuit-breaker configuration
// ---------------------------------------------------------------------------
const FLUSH_INTERVAL_MS = 5_000; // flush every 5 s
const MAX_BUFFER_SIZE = 500; // flush early if buffer grows beyond this
const CB_FAILURE_THRESHOLD = 5; // consecutive failures before opening circuit
const CB_COOLDOWN_MS = 30_000; // how long to stay open before half-open probe
const MAX_DROPPED_LOG_INTERVAL_MS = 60_000; // rate-limit "dropped events" warnings

type BufferKey = string; // `${apiKeyId}|${day}|${route}|${method}`

interface BufferEntry {
  apiKeyId: string;
  day: Date;
  route: string;
  method: string;
  count: number;
  sumDurationMs: number;
  sumBytesIn: number;
  sumBytesOut: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

// ---------------------------------------------------------------------------
// Module-level state (exported for testing)
// ---------------------------------------------------------------------------
export const _buffer = new Map<BufferKey, BufferEntry>();

export const _circuit = {
  state: 'closed' as CircuitState,
  consecutiveFailures: 0,
  openedAt: 0,
  droppedEvents: 0,
  lastDroppedLogAt: 0,
};

function makeBufferKey(apiKeyId: string, day: Date, route: string, method: string): BufferKey {
  return `${apiKeyId}|${day.toISOString()}|${route}|${method}`;
}

// ---------------------------------------------------------------------------
// Flush logic
// ---------------------------------------------------------------------------
export async function flushBuffer(log?: { warn: (...args: unknown[]) => void }): Promise<void> {
  if (_buffer.size === 0) return;

  // Snapshot and clear so new events accumulate in a fresh map
  const entries = [..._buffer.values()];
  _buffer.clear();

  // If circuit is open, check cooldown
  if (_circuit.state === 'open') {
    if (Date.now() - _circuit.openedAt < CB_COOLDOWN_MS) {
      // Still in cooldown — drop events
      _circuit.droppedEvents += entries.reduce((s, e) => s + e.count, 0);
      logDroppedIfNeeded(log);
      return;
    }
    // Cooldown elapsed -> half-open: try a single probe
    _circuit.state = 'half-open';
  }

  try {
    // Bulk upsert all buffered entries in a single multi-row INSERT statement
    const now = new Date();
    const rows = entries.map((entry) => ({
      apiKeyId: entry.apiKeyId,
      day: entry.day,
      route: entry.route,
      method: entry.method,
      count: entry.count,
      sumDurationMs: entry.sumDurationMs,
      sumBytesIn: entry.sumBytesIn,
      sumBytesOut: entry.sumBytesOut,
      lastAt: now,
    }));

    await db
      .insert(apiUsageTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          apiUsageTable.apiKeyId,
          apiUsageTable.day,
          apiUsageTable.route,
          apiUsageTable.method,
        ],
        set: {
          count: sql`${apiUsageTable.count} + excluded.count`,
          sumDurationMs: sql`${apiUsageTable.sumDurationMs} + excluded.sum_duration_ms`,
          sumBytesIn: sql`${apiUsageTable.sumBytesIn} + excluded.sum_bytes_in`,
          sumBytesOut: sql`${apiUsageTable.sumBytesOut} + excluded.sum_bytes_out`,
          lastAt: now,
          updatedAt: now,
        },
      });

    // Success -> close circuit
    if (_circuit.state !== 'closed') {
      log?.warn(
        { previousState: _circuit.state, droppedEvents: _circuit.droppedEvents },
        'usage metering circuit breaker closed — DB recovered'
      );
    }
    _circuit.state = 'closed';
    _circuit.consecutiveFailures = 0;
  } catch (err) {
    _circuit.consecutiveFailures++;

    if (_circuit.state === 'half-open' || _circuit.consecutiveFailures >= CB_FAILURE_THRESHOLD) {
      _circuit.state = 'open';
      _circuit.openedAt = Date.now();
      log?.warn(
        {
          err,
          consecutiveFailures: _circuit.consecutiveFailures,
          bufferedEntries: entries.length,
        },
        'usage metering circuit breaker OPEN — suspending DB writes'
      );
    } else {
      log?.warn(
        { err, consecutiveFailures: _circuit.consecutiveFailures },
        'usage metering flush failed'
      );
    }

    // Re-buffer the failed entries so they can be retried on next flush
    for (const entry of entries) {
      const key = makeBufferKey(entry.apiKeyId, entry.day, entry.route, entry.method);
      const existing = _buffer.get(key);
      if (existing) {
        existing.count += entry.count;
        existing.sumDurationMs += entry.sumDurationMs;
        existing.sumBytesIn += entry.sumBytesIn;
        existing.sumBytesOut += entry.sumBytesOut;
      } else {
        _buffer.set(key, { ...entry });
      }
    }

    // If buffer grew too large after re-buffering, trim oldest entries
    if (_buffer.size > MAX_BUFFER_SIZE * 2) {
      const excess = _buffer.size - MAX_BUFFER_SIZE;
      let dropped = 0;
      for (const [k, v] of _buffer) {
        if (dropped >= excess) break;
        _circuit.droppedEvents += v.count;
        _buffer.delete(k);
        dropped++;
      }
      logDroppedIfNeeded(log);
    }
  }
}

function logDroppedIfNeeded(log?: { warn: (...args: unknown[]) => void }): void {
  if (_circuit.droppedEvents === 0) return;
  const now = Date.now();
  if (now - _circuit.lastDroppedLogAt < MAX_DROPPED_LOG_INTERVAL_MS) return;
  _circuit.lastDroppedLogAt = now;
  log?.warn(
    { droppedEvents: _circuit.droppedEvents, circuitState: _circuit.state },
    'usage metering events dropped due to circuit breaker'
  );
}

// Exported for testing
export function resetState(): void {
  _buffer.clear();
  _circuit.state = 'closed';
  _circuit.consecutiveFailures = 0;
  _circuit.openedAt = 0;
  _circuit.droppedEvents = 0;
  _circuit.lastDroppedLogAt = 0;
}

export default fp(
  async function usagePlugin(app: FastifyInstance) {
    app.decorateRequest('_usage', undefined);

    // Periodic flush timer
    const flushTimer = setInterval(() => {
      flushBuffer(app.log).catch((err) => {
        app.log.warn({ err }, 'usage metering periodic flush error');
      });
    }, FLUSH_INTERVAL_MS);

    // Clear timer on shutdown and perform final flush
    app.addHook('onClose', async () => {
      clearInterval(flushTimer);
      try {
        await flushBuffer(app.log);
      } catch (err) {
        app.log.error({ err }, 'usage metering final flush failed on shutdown');
      }
    });

    app.addHook('onRequest', async (req) => {
      const bytesIn = Number(req.headers['content-length'] || 0);
      req._usage = { start: Date.now(), bytesIn, bytesOut: 0 };
    });

    app.addHook('onSend', async (req, _reply, payload) => {
      if (!req._usage) req._usage = { start: Date.now(), bytesIn: 0, bytesOut: 0 };
      if (typeof payload === 'string') req._usage.bytesOut = Buffer.byteLength(payload);
      else if (Buffer.isBuffer(payload)) req._usage.bytesOut = payload.length;
    });

    app.addHook('onResponse', async (req) => {
      try {
        const apiKeyId = req.apiKey?.id;
        if (!apiKeyId) return;

        const u = req._usage!;
        const duration = Math.max(0, Date.now() - u.start);

        const day = dayStartUTC();
        const route =
          (req.routeOptions && typeof req.routeOptions.url === 'string'
            ? req.routeOptions.url
            : req.raw.url?.split('?')[0]) ?? 'unknown';

        const method = req.method;
        const key = makeBufferKey(apiKeyId, day, route, method);

        const existing = _buffer.get(key);
        if (existing) {
          existing.count += 1;
          existing.sumDurationMs += duration;
          existing.sumBytesIn += u.bytesIn || 0;
          existing.sumBytesOut += u.bytesOut || 0;
        } else {
          _buffer.set(key, {
            apiKeyId,
            day,
            route,
            method,
            count: 1,
            sumDurationMs: duration,
            sumBytesIn: u.bytesIn || 0,
            sumBytesOut: u.bytesOut || 0,
          });
        }

        // Flush early if buffer is large
        if (_buffer.size >= MAX_BUFFER_SIZE) {
          flushBuffer(req.log).catch((err) => {
            req.log.warn({ err }, 'usage metering early flush error');
          });
        }
      } catch (err) {
        req.log.warn({ err }, 'usage metering failed');
      }
    });
  },
  { name: 'usage-plugin' }
);
