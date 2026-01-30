export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class UpstreamError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function extractErrorMessage(value: unknown, fallback = 'Unknown error'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const err = (value as { error?: unknown }).error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string' && message.length) return message;
    }
  }
  return fallback;
}

export function formatError(e: unknown, fallback = 'Unknown error'): string {
  if (e instanceof ApiError || e instanceof UpstreamError) return e.message;
  if (e && typeof e === 'object') {
    const status = (e as { status?: unknown }).status;
    const message = (e as { message?: unknown }).message;
    if (typeof status === 'number' && typeof message === 'string') {
      return `${status} ${message}`;
    }
  }
  if (e instanceof Error) return e.message;
  if (e == null) return fallback;
  return String(e);
}
