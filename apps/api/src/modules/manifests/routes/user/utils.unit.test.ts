import { describe, expect, it } from 'vitest';
import { mapRecordToItem } from './utils.js';

describe('manifest CSV row mapping', () => {
  it('maps quantity and liters from canonical column names', () => {
    const out = mapRecordToItem(
      {
        itemvalueamount: '10',
        itemvaluecurrency: 'USD',
        weightkg: '2',
        quantity: '4',
        liters: '1.5',
        dimsl: '1',
        dimsw: '2',
        dimsh: '3',
      },
      'manifest-1'
    );

    expect(out.manifestId).toBe('manifest-1');
    expect(out.quantity).toBe('4');
    expect(out.liters).toBe('1.5');
    expect(out.dimsCm).toEqual({ l: 1, w: 2, h: 3 });
  });

  it('maps quantity/liters aliases from qty/litres', () => {
    const out = mapRecordToItem(
      {
        itemvalueamount: '10',
        itemvaluecurrency: 'USD',
        weightkg: '2',
        qty: '7',
        litres: '2',
      },
      'manifest-1'
    );

    expect(out.quantity).toBe('7');
    expect(out.liters).toBe('2');
  });
});
