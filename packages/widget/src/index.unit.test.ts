// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatMoney, callQuote, mountAll } from './index.js';
import type { QuoteBody, SDK } from './index.js';

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe('formatMoney', () => {
  it('formats USD amounts with $ symbol', () => {
    const result = formatMoney(42.5, 'USD', 'en-US');
    expect(result).toBe('$42.50');
  });

  it('formats EUR amounts', () => {
    const result = formatMoney(100, 'EUR', 'en-US');
    expect(result).toContain('100.00');
    expect(result).toContain('€');
  });

  it('uses locale for formatting', () => {
    const result = formatMoney(1234.56, 'EUR', 'de-DE');
    // German uses comma as decimal separator
    expect(result).toMatch(/1[.]?234,56/);
  });

  it('handles zero', () => {
    const result = formatMoney(0, 'USD', 'en-US');
    expect(result).toBe('$0.00');
  });

  it('handles negative values', () => {
    const result = formatMoney(-10, 'USD', 'en-US');
    expect(result).toContain('10.00');
  });

  it('falls back to basic format for invalid currency', () => {
    const result = formatMoney(99, 'INVALID', 'en-US');
    expect(result).toBe('INVALID 99.00');
  });

  it('defaults locale to en-US', () => {
    const result = formatMoney(50, 'USD');
    expect(result).toBe('$50.00');
  });
});

// ---------------------------------------------------------------------------
// callQuote
// ---------------------------------------------------------------------------

const sampleBody: QuoteBody = {
  origin: 'US',
  dest: 'DE',
  itemValue: { amount: 120, currency: 'USD' },
  dimsCm: { l: 20, w: 15, h: 10 },
  weightKg: 1.2,
  categoryKey: 'general',
  mode: 'air',
};

const sampleResponse = {
  components: { CIF: 130, duty: 5, vat: 18, fees: 2 },
  total: 155,
  incoterm: 'DAP',
  currency: 'EUR',
};

describe('callQuote', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('calls proxyUrl when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleResponse),
      text: () => Promise.resolve(JSON.stringify(sampleResponse)),
    });
    globalThis.fetch = mockFetch;

    const sdk: SDK = { proxyUrl: '/api/clearcost/quote' };
    const result = await callQuote(sampleBody, sdk);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('/api/clearcost/quote');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toMatch(/^ck_idem_/);
    expect(JSON.parse(init.body)).toEqual(sampleBody);
    expect(result).toEqual(sampleResponse);
  });

  it('calls direct API when baseUrl + apiKey are provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleResponse),
      text: () => Promise.resolve(JSON.stringify(sampleResponse)),
    });
    globalThis.fetch = mockFetch;

    const sdk: SDK = { baseUrl: 'https://api.clearcost.dev', apiKey: 'sk_test_123' };
    await callQuote(sampleBody, sdk);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.clearcost.dev/v1/quotes');
    expect(init.headers['Authorization']).toBe('Bearer sk_test_123');
  });

  it('throws when missing both proxyUrl and baseUrl/apiKey', async () => {
    await expect(callQuote(sampleBody, {})).rejects.toThrow('Missing baseUrl/apiKey or proxyUrl');
  });

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('Unsupported trade lane'),
    });
    globalThis.fetch = mockFetch;

    await expect(callQuote(sampleBody, { proxyUrl: '/proxy' })).rejects.toThrow(
      '422 Unsupported trade lane'
    );
  });
});

// ---------------------------------------------------------------------------
// mountAll — DOM integration
// ---------------------------------------------------------------------------

describe('mountAll', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Remove injected styles from previous tests
    document.getElementById('cc-widget-styles')?.remove();
  });

  it('injects CSS custom property stylesheet', () => {
    mountAll({ proxyUrl: '/proxy' });
    const style = document.getElementById('cc-widget-styles');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('--cc-font-family');
    expect(style!.textContent).toContain('--cc-bg');
    expect(style!.textContent).toContain('--cc-btn-bg');
  });

  it('does not inject duplicate stylesheets', () => {
    mountAll({ proxyUrl: '/proxy' });
    mountAll({ proxyUrl: '/proxy' });
    const styles = document.querySelectorAll('#cc-widget-styles');
    expect(styles.length).toBe(1);
  });

  it('mounts a button for each [data-clearcost] element', () => {
    document.body.innerHTML = `
      <div data-clearcost data-origin="US" data-dest="DE" data-price="100" data-l="20" data-w="15" data-h="10" data-weight="1.2"></div>
      <div data-clearcost data-origin="CN" data-dest="US" data-price="50" data-l="10" data-w="10" data-h="10" data-weight="0.5"></div>
    `;

    mountAll({ proxyUrl: '/proxy' });

    const buttons = document.querySelectorAll('button.cc-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0]!.textContent).toBe('Estimate duties & taxes');
    expect(buttons[1]!.textContent).toBe('Estimate duties & taxes');
  });

  it('creates a result container for each element', () => {
    document.body.innerHTML = `
      <div data-clearcost data-origin="US" data-dest="DE" data-price="100" data-l="20" data-w="15" data-h="10" data-weight="1.2"></div>
    `;

    mountAll({ proxyUrl: '/proxy' });

    const result = document.querySelector('.cc-result');
    expect(result).not.toBeNull();
  });

  it('does nothing when no [data-clearcost] elements exist', () => {
    document.body.innerHTML = '<div>No widgets here</div>';
    mountAll({ proxyUrl: '/proxy' });
    expect(document.querySelectorAll('.cc-btn').length).toBe(0);
  });

  it('button click triggers fetch and renders result on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          components: { CIF: 130, duty: 5, vat: 18, fees: 2 },
          total: 155,
          incoterm: 'DAP',
          currency: 'USD',
        }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            components: { CIF: 130, duty: 5, vat: 18, fees: 2 },
            total: 155,
            incoterm: 'DAP',
            currency: 'USD',
          })
        ),
    });
    globalThis.fetch = mockFetch;

    document.body.innerHTML = `
      <div data-clearcost data-origin="US" data-dest="DE" data-price="100" data-currency="USD" data-l="20" data-w="15" data-h="10" data-weight="1.2"></div>
    `;

    mountAll({ proxyUrl: '/proxy' });

    const button = document.querySelector('button.cc-btn') as HTMLButtonElement;
    expect(button).not.toBeNull();

    // Click the button to trigger calculation
    button.click();

    // Wait for async fetch to complete
    await vi.waitFor(() => {
      expect(button.textContent).toBe('Recalculate');
    });

    // Check result rendered
    const wrap = document.querySelector('.cc-wrap');
    expect(wrap).not.toBeNull();
    expect(wrap!.textContent).toContain('Landed cost');
    expect(wrap!.textContent).toContain('Duty');
    expect(wrap!.textContent).toContain('VAT');
    expect(wrap!.textContent).toContain('DAP');
  });

  it('shows error message on fetch failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    });
    globalThis.fetch = mockFetch;

    document.body.innerHTML = `
      <div data-clearcost data-origin="US" data-dest="DE" data-price="100" data-l="20" data-w="15" data-h="10" data-weight="1.2"></div>
    `;

    mountAll({ proxyUrl: '/proxy' });

    const button = document.querySelector('button.cc-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      expect(button.textContent).toBe('Retry');
    });

    const result = document.querySelector('.cc-result');
    expect(result!.textContent).toContain('Failed:');
  });

  it('disables button during loading', async () => {
    let resolvePromise: (value: any) => void;
    const mockFetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );
    globalThis.fetch = mockFetch;

    document.body.innerHTML = `
      <div data-clearcost data-origin="US" data-dest="DE" data-price="100" data-l="20" data-w="15" data-h="10" data-weight="1.2"></div>
    `;

    mountAll({ proxyUrl: '/proxy' });

    const button = document.querySelector('button.cc-btn') as HTMLButtonElement;
    button.click();

    // Wait for the fetch to be called (async chain includes genIdemKey before fetch)
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Should be disabled and show loading text while fetch is pending
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Calculating…');

    // Resolve the fetch
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve(sampleResponse),
      text: () => Promise.resolve(JSON.stringify(sampleResponse)),
    });

    await vi.waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });

  it('reads data attributes correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleResponse),
      text: () => Promise.resolve(JSON.stringify(sampleResponse)),
    });
    globalThis.fetch = mockFetch;

    document.body.innerHTML = `
      <div data-clearcost
        data-origin="CN"
        data-dest="GB"
        data-price="250"
        data-currency="GBP"
        data-l="30"
        data-w="25"
        data-h="15"
        data-weight="2.5"
        data-category-key="electronics"
        data-hs6="850440"
        data-mode="sea"
      ></div>
    `;

    mountAll({ proxyUrl: '/proxy' });

    const button = document.querySelector('button.cc-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.origin).toBe('CN');
    expect(body.dest).toBe('GB');
    expect(body.itemValue).toEqual({ amount: 250, currency: 'GBP' });
    expect(body.dimsCm).toEqual({ l: 30, w: 25, h: 15 });
    expect(body.weightKg).toBe(2.5);
    expect(body.categoryKey).toBe('electronics');
    expect(body.hs6).toBe('850440');
    expect(body.mode).toBe('sea');
  });

  it('auto-calculates when auto option is set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleResponse),
      text: () => Promise.resolve(JSON.stringify(sampleResponse)),
    });
    globalThis.fetch = mockFetch;

    document.body.innerHTML = `
      <div data-clearcost data-origin="US" data-dest="DE" data-price="100" data-l="20" data-w="15" data-h="10" data-weight="1.2"></div>
    `;

    mountAll({ proxyUrl: '/proxy', auto: true });

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
