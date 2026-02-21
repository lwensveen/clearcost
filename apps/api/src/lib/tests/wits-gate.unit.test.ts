import { describe, expect, it } from 'vitest';
import {
  assertWitsImportsEnabled,
  isWitsImportsEnabled,
  witsImportsDisabledMessage,
} from '../wits-gate.js';

describe('wits gate', () => {
  it('treats ENABLE_WITS_IMPORTS=true as enabled', () => {
    expect(isWitsImportsEnabled({ ENABLE_WITS_IMPORTS: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('treats ENABLE_WITS_BACKFILL=true as enabled', () => {
    expect(isWitsImportsEnabled({ ENABLE_WITS_BACKFILL: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('treats missing flags as disabled', () => {
    expect(isWitsImportsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('throws explicit message when disabled', () => {
    expect(() => assertWitsImportsEnabled({} as NodeJS.ProcessEnv)).toThrow(
      witsImportsDisabledMessage()
    );
  });
});
