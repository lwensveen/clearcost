import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

vi.mock('dotenv/config', () => ({}));

const { store } = vi.hoisted(() => ({
  store: {} as Record<string, (args: string[]) => any | Promise<any>>,
}));

vi.mock('../cron/registry.js', () => ({
  commands: store,
}));

const SUT = '../run-cron.ts';

const ORIGINAL_ARGV = [...process.argv];
let exitSpy: MockInstance;
let errorSpy: MockInstance;

class ExitCalled extends Error {
  code?: number;
  constructor(code?: number) {
    super(`exit:${code}`);
    this.code = code;
  }
}

async function importSutCatchingExit() {
  vi.resetModules();
  try {
    await import(SUT);
  } catch (e) {
    if (!(e instanceof ExitCalled)) throw e;
  }
  await Promise.resolve();
}

describe('run-cron CLI', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: any) => {
      // no-op; tests will still see the call
    }) as never);

    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    process.argv = [...ORIGINAL_ARGV.slice(0, 2)];
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    process.argv = [...ORIGINAL_ARGV];
  });

  it('prints usage and exits(1) when no task is provided', async () => {
    store.zeta = async () => {};
    store.alpha = async () => {};

    exitSpy.mockImplementationOnce(((_code?: any) => {
      throw new ExitCalled(1);
    }) as never);

    process.argv = ['bun', 'run'];
    await importSutCatchingExit();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const msg = (errorSpy.mock.calls[0]?.[0] as string) ?? '';
    expect(msg).toContain('Usage:');
    expect(msg).toContain('Tasks:');
    expect(msg).toMatch(/alpha/);
    expect(msg).toMatch(/zeta/);
  });

  it('prints usage and exits(1) for unknown task', async () => {
    store.build = async () => {};
    store.lint = async () => {};

    exitSpy.mockImplementationOnce(((_code?: any) => {
      throw new ExitCalled(1);
    }) as never);

    process.argv = ['bun', 'run', 'unknown'];
    await importSutCatchingExit();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const msg = (errorSpy.mock.calls[0]?.[0] as string) ?? '';
    expect(msg).toContain('Usage:');
    expect(msg).toContain('Tasks:');
    expect(msg).toMatch(/build/);
    expect(msg).toMatch(/lint/);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('invokes the selected task with argv args and does not exit on success', async () => {
    const fn = vi.fn(async (args: string[]) => {
      expect(args).toEqual(['--dry-run', 'foo']);
    });
    store.deploy = fn;

    process.argv = ['bun', 'run', 'deploy', '--dry-run', 'foo'];
    await importSutCatchingExit();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs the error and exits(1) when the task rejects', async () => {
    const err = new Error('boom');
    store.failtask = vi.fn(async () => {
      throw err;
    });

    process.argv = ['bun', 'run', 'failtask'];
    await importSutCatchingExit();

    expect(store.failtask).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
