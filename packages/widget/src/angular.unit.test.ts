import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Angular decorators are no-ops when not compiled; import the class directly.
import { ClearCostQuoteComponent } from './angular.js';

function createComponent(overrides: Partial<ClearCostQuoteComponent> = {}) {
  const cdr = { detectChanges: vi.fn() } as any;
  const comp = new ClearCostQuoteComponent(cdr);

  // Set required inputs
  comp.origin = 'US';
  comp.dest = 'DE';
  comp.price = 100;
  comp.l = 20;
  comp.w = 15;
  comp.h = 10;
  comp.weight = 1.2;

  Object.assign(comp, overrides);
  return { comp, cdr };
}

describe('ClearCostQuoteComponent (Angular)', () => {
  beforeEach(() => {
    mocks.callQuote.mockReset();
  });

  it('has correct initial state', () => {
    const { comp } = createComponent();
    expect(comp.quote).toBeNull();
    expect(comp.loading).toBe(false);
    expect(comp.error).toBeNull();
    expect(comp.hasRun).toBe(false);
    expect(comp.currency).toBe('USD');
    expect(comp.mode).toBe('air');
    expect(comp.locale).toBe('en-US');
  });

  it('freight returns 0 when no quote', () => {
    const { comp } = createComponent();
    expect(comp.freight).toBe(0);
  });

  it('freight computes CIF - price', () => {
    const { comp } = createComponent();
    comp.quote = { ...sampleResponse, itemValue: 100 };
    expect(comp.freight).toBe(30); // CIF 130 - price 100
  });

  it('money formats currency', () => {
    const { comp } = createComponent();
    expect(comp.money(42.5)).toBe('$42.50');
  });

  it('money uses component currency and locale', () => {
    const { comp } = createComponent({ currency: 'EUR', locale: 'en-US' });
    const result = comp.money(100);
    expect(result).toContain('€');
    expect(result).toContain('100.00');
  });

  it('calculate calls callQuote with correct body and sdk', async () => {
    mocks.callQuote.mockResolvedValueOnce({ ...sampleResponse });
    const { comp, cdr } = createComponent({ proxyUrl: '/proxy', hs6: '850440', mode: 'sea' });

    await comp.calculate();

    expect(mocks.callQuote).toHaveBeenCalledTimes(1);
    const [body, sdk] = mocks.callQuote.mock.calls[0]!;

    expect(body.origin).toBe('US');
    expect(body.dest).toBe('DE');
    expect(body.itemValue).toEqual({ amount: 100, currency: 'USD' });
    expect(body.dimsCm).toEqual({ l: 20, w: 15, h: 10 });
    expect(body.weightKg).toBe(1.2);
    expect(body.hs6).toBe('850440');
    expect(body.mode).toBe('sea');
    expect(sdk.proxyUrl).toBe('/proxy');

    expect(cdr.detectChanges).toHaveBeenCalled();
  });

  it('calculate sets quote and hasRun on success', async () => {
    mocks.callQuote.mockResolvedValueOnce({ ...sampleResponse });
    const { comp } = createComponent();

    await comp.calculate();

    expect(comp.quote).not.toBeNull();
    expect(comp.quote!.total).toBe(155);
    expect(comp.quote!.itemValue).toBe(100); // price is set
    expect(comp.hasRun).toBe(true);
    expect(comp.loading).toBe(false);
    expect(comp.error).toBeNull();
  });

  it('calculate sets error on failure', async () => {
    mocks.callQuote.mockRejectedValueOnce(new Error('Server down'));
    const { comp } = createComponent();

    await comp.calculate();

    expect(comp.error).toBe('Server down');
    expect(comp.quote).toBeNull();
    expect(comp.hasRun).toBe(true);
    expect(comp.loading).toBe(false);
  });

  it('calculate handles non-Error throws', async () => {
    mocks.callQuote.mockRejectedValueOnce(42);
    const { comp } = createComponent();

    await comp.calculate();

    expect(comp.error).toBe('Request failed');
  });

  it('calculate calls detectChanges at start and end', async () => {
    mocks.callQuote.mockResolvedValueOnce({ ...sampleResponse });
    const { comp, cdr } = createComponent();

    await comp.calculate();

    // Called at least twice: once at start (loading=true), once at end (loading=false)
    expect(cdr.detectChanges.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ngOnInit calls calculate when auto is true', () => {
    const { comp } = createComponent({ auto: true });
    mocks.callQuote.mockResolvedValueOnce({ ...sampleResponse });

    const spy = vi.spyOn(comp, 'calculate').mockResolvedValue(undefined);
    comp.ngOnInit();

    expect(spy).toHaveBeenCalled();
  });

  it('ngOnInit does not call calculate when auto is false', () => {
    const { comp } = createComponent({ auto: false });

    const spy = vi.spyOn(comp, 'calculate');
    comp.ngOnInit();

    expect(spy).not.toHaveBeenCalled();
  });
});
