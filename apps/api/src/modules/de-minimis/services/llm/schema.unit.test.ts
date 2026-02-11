import { describe, expect, it } from 'vitest';
import { PayloadSchema } from './schema.js';

describe('DeMinimis LLM PayloadSchema', () => {
  it('requires an explicit basis per row', () => {
    expect(() =>
      PayloadSchema.parse({
        rows: [
          {
            country_code: 'US',
            kind: 'DUTY',
            currency: 'USD',
            value: 800,
            effective_from: '2025-01-01',
            effective_to: null,
            source_url: 'https://www.cbp.gov',
          },
        ],
      })
    ).toThrow(/basis/i);
  });

  it('accepts rows with explicit basis', () => {
    const parsed = PayloadSchema.parse({
      rows: [
        {
          country_code: 'GB',
          kind: 'VAT',
          basis: 'INTRINSIC',
          currency: 'GBP',
          value: 135,
          effective_from: '2025-01-01',
          effective_to: null,
          source_url: 'https://www.gov.uk',
        },
      ],
    });

    expect(parsed.rows[0]?.basis).toBe('INTRINSIC');
  });
});
