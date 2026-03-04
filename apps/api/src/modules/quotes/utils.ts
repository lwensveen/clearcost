export { EU_ISO2, isEuMember } from '../../lib/eu.js';

export function volumetricKg({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 5000;
}

export function volumeM3({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 1_000_000;
}
