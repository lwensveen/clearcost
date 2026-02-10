import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpFetchMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('../../../lib/http.js', () => ({
  httpFetch: mocks.httpFetchMock,
}));

vi.mock('@clearcost/db', () => ({
  db: {
    transaction: mocks.transactionMock,
  },
  deMinimisTable: {},
  provenanceTable: {},
}));

import { importDeMinimisFromZonos } from './import-from-zonos.js';

describe('importDeMinimisFromZonos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({});
    });
  });

  it('fails fast when parsed table yields zero upsert rows', async () => {
    const html = `
      <html>
        <body>
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>ISO</th>
                <th>Duty threshold</th>
                <th>Tax threshold</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </body>
      </html>
    `;
    mocks.httpFetchMock.mockResolvedValue(new Response(html, { status: 200 }));

    await expect(importDeMinimisFromZonos(new Date('2025-01-01T00:00:00.000Z'))).rejects.toThrow(
      /source produced 0 rows/i
    );
  });
});
