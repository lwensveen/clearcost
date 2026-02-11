import { describe, expect, it } from 'vitest';
import { resolveSurchargeRateType } from './rate-type.js';

describe('resolveSurchargeRateType', () => {
  it('infers ad_valorem from pctAmt when rateType is missing', () => {
    expect(
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=MPF',
        pctAmt: '0.003464',
      })
    ).toBe('ad_valorem');
  });

  it('infers fixed from fixedAmt when rateType is missing', () => {
    expect(
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=OTHER',
        fixedAmt: '12.5',
      })
    ).toBe('fixed');
  });

  it('infers per_unit from unitAmt when rateType is missing', () => {
    expect(
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=AQI_AIRCRAFT',
        unitAmt: '125.0',
      })
    ).toBe('per_unit');
  });

  it('accepts explicit fixed rows with unitAmt', () => {
    expect(
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=FDA_FSMA_REINSPECTION_HOURLY_DOM',
        rawRateType: 'fixed',
        unitAmt: '224.0',
      })
    ).toBe('fixed');
  });

  it('normalizes "unit" alias to per_unit', () => {
    expect(
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=FDA_VQIP_APPLICATION_FEE',
        rawRateType: 'unit',
        unitAmt: '5000',
      })
    ).toBe('per_unit');
  });

  it('fails on ambiguous missing rateType rows', () => {
    expect(() =>
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=OTHER',
        fixedAmt: '10',
        pctAmt: '0.01',
      })
    ).toThrow(/ambiguous surcharge ratetype/i);
  });

  it('fails on invalid explicit rateType', () => {
    expect(() =>
      resolveSurchargeRateType({
        rowLabel: 'dest=US:code=OTHER',
        rawRateType: 'tiered',
        fixedAmt: '10',
      })
    ).toThrow(/invalid surcharge ratetype/i);
  });
});
