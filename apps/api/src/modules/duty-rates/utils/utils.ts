import { DutyComponentInput } from './components.js';

export function isoOrNull(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  if (input instanceof Date) return input.toISOString();
  const parsed = new Date(input);
  return Number.isNaN(+parsed) ? null : parsed.toISOString();
}

export function clamp(text: string | undefined, max = 255) {
  return typeof text === 'string' ? text.slice(0, max) : undefined;
}

export const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

export function isAdValorem(
  component: DutyComponentInput
): component is Extract<DutyComponentInput, { type: 'advalorem' }> {
  return component.type === 'advalorem';
}
export function hasAmountFields(
  component: DutyComponentInput
): component is Extract<DutyComponentInput, { amount: number }> {
  return 'amount' in component;
}
export function hasCurrency(
  component: DutyComponentInput
): component is Extract<DutyComponentInput, { currency: string }> {
  return 'currency' in component;
}
export function hasUom(
  component: DutyComponentInput
): component is Extract<DutyComponentInput, { uom: string }> {
  return 'uom' in component;
}
export function hasQualifier(
  component: DutyComponentInput
): component is Extract<DutyComponentInput, { qualifier?: string }> {
  return 'qualifier' in component;
}
export function hasFormula(
  component: DutyComponentInput
): component is Extract<DutyComponentInput, { formula?: unknown }> {
  return 'formula' in component;
}
