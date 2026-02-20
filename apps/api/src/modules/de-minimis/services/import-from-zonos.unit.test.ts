import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpFetchMock: vi.fn(),
  transactionMock: vi.fn(),
  resolveZonosDeMinimisUrlMock: vi.fn(),
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

vi.mock('./source-urls.js', () => ({
  resolveZonosDeMinimisUrl: mocks.resolveZonosDeMinimisUrlMock,
}));

import { importDeMinimisFromZonos, resolveZonosBasis } from './import-from-zonos.js';

describe('importDeMinimisFromZonos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveZonosDeMinimisUrlMock.mockResolvedValue('https://zonos.test/de-minimis');
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
    expect(mocks.resolveZonosDeMinimisUrlMock).toHaveBeenCalledWith(undefined);
  });

  it('resolves basis overrides and defaults conservatively for unknown destinations', () => {
    expect(resolveZonosBasis('US', 'DUTY')).toBe('INTRINSIC');
    expect(resolveZonosBasis('GB', 'VAT')).toBe('INTRINSIC');
    expect(resolveZonosBasis('NL', 'DUTY')).toBe('INTRINSIC');
    expect(resolveZonosBasis('BR', 'DUTY')).toBe('CIF');
    expect(resolveZonosBasis('BR', 'VAT')).toBe('CIF');
  });

  it('writes conservative CIF basis for unknown rows and preserves known overrides', async () => {
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
            <tbody>
              <tr><td>Brazil</td><td>BR</td><td>50 USD</td><td>20 USD</td></tr>
              <tr><td>United States</td><td>US</td><td>800 USD</td><td></td></tr>
              <tr><td>United Kingdom</td><td>GB</td><td></td><td>135 GBP</td></tr>
              <tr><td>Netherlands</td><td>NL</td><td>150 EUR</td><td></td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    mocks.httpFetchMock.mockResolvedValue(new Response(html, { status: 200 }));

    const inserted: Array<{ dest: string; deMinimisKind: string; deMinimisBasis: string }> = [];
    let seq = 0;
    mocks.transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: () => ({
          values: (row: {
            dest: string;
            deMinimisKind: string;
            deMinimisBasis: string;
            currency: string;
            value: string;
          }) => {
            inserted.push({
              dest: row.dest,
              deMinimisKind: row.deMinimisKind,
              deMinimisBasis: row.deMinimisBasis,
            });
            return {
              onConflictDoUpdate: () => ({
                returning: async () => [{ id: `row-${++seq}`, inserted: 1 }],
              }),
            };
          },
        }),
      };
      await fn(tx);
    });

    const out = await importDeMinimisFromZonos(new Date('2025-01-01T00:00:00.000Z'));
    expect(out.count).toBe(5);

    const basisByKey = new Map(
      inserted.map((row) => [`${row.dest}:${row.deMinimisKind}`, row.deMinimisBasis])
    );
    expect(basisByKey.get('BR:DUTY')).toBe('CIF');
    expect(basisByKey.get('BR:VAT')).toBe('CIF');
    expect(basisByKey.get('US:DUTY')).toBe('INTRINSIC');
    expect(basisByKey.get('GB:VAT')).toBe('INTRINSIC');
    expect(basisByKey.get('NL:DUTY')).toBe('INTRINSIC');
  });
});
