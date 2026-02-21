import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../../source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import {
  PROGRAMS_MEMBERS_SOURCE_KEY,
  resolveProgramsMembersCsvUrl,
} from './trade-programs-source-urls.js';

describe('resolveProgramsMembersCsvUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns explicit override URL and skips source registry', async () => {
    const out = await resolveProgramsMembersCsvUrl('https://example.test/members.csv');

    expect(out).toBe('https://example.test/members.csv');
    expect(mocks.resolveSourceDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('resolves URL from source registry when no override is provided', async () => {
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('https://registry.test/members.csv');

    const out = await resolveProgramsMembersCsvUrl();

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith({
      sourceKey: PROGRAMS_MEMBERS_SOURCE_KEY,
    });
    expect(out).toBe('https://registry.test/members.csv');
  });

  it('returns undefined when source registry lookup fails', async () => {
    mocks.resolveSourceDownloadUrlMock.mockRejectedValue(new Error('source not configured'));

    const out = await resolveProgramsMembersCsvUrl();

    expect(out).toBeUndefined();
  });
});
