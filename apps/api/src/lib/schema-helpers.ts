export const rateLimitHeaders = {
  'RateLimit-Limit': {
    description: 'Total requests allowed in the current window',
    schema: { type: 'integer' },
  },
  'RateLimit-Remaining': {
    description: 'Remaining requests in the current window',
    schema: { type: 'integer' },
  },
  'RateLimit-Reset': {
    description: 'Unix epoch (sec) when quota resets',
    schema: { type: 'integer' },
  },
} as const;

type ResponseSchema = Record<string, unknown> & { headers?: Record<string, unknown> };
type Schema = Record<string, unknown> & { response?: Record<string, ResponseSchema> };

export function withRateLimit(schema: Schema): Schema {
  return {
    ...schema,
    response: Object.fromEntries(
      Object.entries(schema.response ?? {}).map(([code, s]) => {
        const existing = (s as ResponseSchema).headers ?? {};
        const headers = { ...existing, ...rateLimitHeaders };
        return [code, { ...s, headers }];
      })
    ),
  };
}
