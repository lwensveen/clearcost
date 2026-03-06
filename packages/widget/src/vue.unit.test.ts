// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

const sampleResponse = {
  components: { CIF: 130, duty: 5, vat: 18, fees: 2 },
  total: 155,
  incoterm: 'DAP',
  currency: 'EUR',
};

const mocks = vi.hoisted(() => ({
  callQuote: vi.fn(),
}));

vi.mock('./index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, callQuote: mocks.callQuote };
});

import { ClearCostQuote } from './vue.js';

const baseProps = {
  origin: 'US',
  dest: 'DE',
  price: 100,
  currency: 'USD',
  l: 20,
  w: 15,
  h: 10,
  weight: 1.2,
  categoryKey: 'general',
  mode: 'air' as const,
  proxyUrl: '/proxy',
  auto: false,
  locale: 'en-US',
};

describe('ClearCostQuote (Vue)', () => {
  beforeEach(() => {
    mocks.callQuote.mockReset();
  });

  it('exports a Vue component with expected name and props', () => {
    expect(ClearCostQuote.name).toBe('ClearCostQuote');
    expect(ClearCostQuote.props).toBeDefined();
    expect(ClearCostQuote.props.origin).toEqual({ type: String, required: true });
    expect(ClearCostQuote.props.dest).toEqual({ type: String, required: true });
    expect(ClearCostQuote.props.price).toEqual({ type: Number, required: true });
  });

  it('setup returns reactive state with initial values', () => {
    const result = ClearCostQuote.setup!(baseProps, {
      attrs: {},
      slots: {},
      emit: vi.fn(),
      expose: vi.fn(),
    } as any);
    expect(result).toBeDefined();
    expect(result!.loading.value).toBe(false);
    expect(result!.error.value).toBeNull();
    expect(result!.quote.value).toBeNull();
    expect(result!.hasRun.value).toBe(false);
    expect(typeof result!.calculate).toBe('function');
  });

  it('calculate sets loading, calls callQuote, and sets quote on success', async () => {
    mocks.callQuote.mockResolvedValueOnce({ ...sampleResponse });

    const result = ClearCostQuote.setup!(baseProps, {
      attrs: {},
      slots: {},
      emit: vi.fn(),
      expose: vi.fn(),
    } as any);

    await result!.calculate();
    await nextTick();

    expect(mocks.callQuote).toHaveBeenCalledTimes(1);
    const [body, sdk] = mocks.callQuote.mock.calls[0]!;
    expect(body.origin).toBe('US');
    expect(body.dest).toBe('DE');
    expect(body.itemValue).toEqual({ amount: 100, currency: 'USD' });
    expect(sdk.proxyUrl).toBe('/proxy');

    expect(result!.quote.value).not.toBeNull();
    expect(result!.quote.value!.total).toBe(155);
    expect(result!.quote.value!.itemValue).toBe(100);
    expect(result!.loading.value).toBe(false);
    expect(result!.hasRun.value).toBe(true);
    expect(result!.error.value).toBeNull();
  });

  it('calculate sets error on failure', async () => {
    mocks.callQuote.mockRejectedValueOnce(new Error('Network error'));

    const result = ClearCostQuote.setup!(baseProps, {
      attrs: {},
      slots: {},
      emit: vi.fn(),
      expose: vi.fn(),
    } as any);

    await result!.calculate();
    await nextTick();

    expect(result!.error.value).toBe('Network error');
    expect(result!.quote.value).toBeNull();
    expect(result!.loading.value).toBe(false);
    expect(result!.hasRun.value).toBe(true);
  });

  it('calculate handles non-Error throws', async () => {
    mocks.callQuote.mockRejectedValueOnce('string error');

    const result = ClearCostQuote.setup!(baseProps, {
      attrs: {},
      slots: {},
      emit: vi.fn(),
      expose: vi.fn(),
    } as any);

    await result!.calculate();

    expect(result!.error.value).toBe('Request failed');
  });

  it('passes hs6 and mode through to callQuote body', async () => {
    mocks.callQuote.mockResolvedValueOnce({ ...sampleResponse });

    const props = { ...baseProps, hs6: '850440', mode: 'sea' as const };
    const result = ClearCostQuote.setup!(props, {
      attrs: {},
      slots: {},
      emit: vi.fn(),
      expose: vi.fn(),
    } as any);

    await result!.calculate();

    const [body] = mocks.callQuote.mock.calls[0]!;
    expect(body.hs6).toBe('850440');
    expect(body.mode).toBe('sea');
  });
});
