export function adValoremPercentToFractionString(percent: number): string {
  const fraction = Number(percent) / 100;
  const normalized = Number.isFinite(fraction) ? fraction : 0;
  const out = normalized.toFixed(6);
  return Number(out) === 0 ? '0.000000' : out;
}
