// tiny CLI harness
import { commands } from './registry.js';

function log(...args: any[]) {
  console.log(...args);
}

async function main() {
  const [cmd = '', ...args] = process.argv.slice(2);
  const fn = commands[cmd];
  if (!fn) {
    log(`Unknown command: ${cmd}\n\nAvailable:\n  ${Object.keys(commands).join('\n  ')}`);
    // Try to force-exit in Bun or Node
    if (typeof (globalThis as any).Bun?.exit === 'function') (globalThis as any).Bun.exit(1);
    else process.exit(1);
    return;
  }

  const started = Date.now();
  log(`→ ${cmd} starting...`);

  let exitCode = 0;
  try {
    await fn(args);
    const ms = Date.now() - started;
    log(`✔ ${cmd} finished in ${ms}ms`);
  } catch (err) {
    exitCode = 1;
    log(`✖ ${cmd} failed:\n`, err instanceof Error ? err.message : err);
  } finally {
    // Hard shutdown even if pools/timers remain
    // Prefer Bun.exit when available
    if (typeof (globalThis as any).Bun?.exit === 'function') (globalThis as any).Bun.exit(exitCode);
    else process.exit(exitCode);
  }
}

main().catch((e) => {
  // last-resort exit
  console.error(e);
  if (typeof (globalThis as any).Bun?.exit === 'function') (globalThis as any).Bun.exit(1);
  else process.exit(1);
});
