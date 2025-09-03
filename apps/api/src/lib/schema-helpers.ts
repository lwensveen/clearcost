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

type Schema = Record<string, any>;

export function withRateLimit(schema: Schema): Schema {
  return {
    ...schema,
    response: Object.fromEntries(
      Object.entries(schema.response ?? {}).map(([code, s]) => {
        const headers = { ...(s as any).headers, ...rateLimitHeaders };
        return [code, { ...(s as any), headers }];
      })
    ),
  };
}
