import { commands } from './registry.js';

function log(...args: any[]) {
  console.log(...args);
}

function end(code: number): never {
  const bun = (globalThis as any).Bun;
  if (bun && typeof bun.exit === 'function') {
    bun.exit(code);
  }
  process.exit(code);
}

async function main() {
  const [cmd = '', ...args] = process.argv.slice(2);
  const fn = commands[cmd as keyof typeof commands];

  if (!fn) {
    log(`Unknown command: ${cmd}\n\nAvailable:\n  ${Object.keys(commands).join('\n  ')}`);
    end(1);
  }

  const started = Date.now();
  log(`→ ${cmd} starting...`);

  try {
    await fn(args);
    const ms = Date.now() - started;
    log(`✔ ${cmd} finished in ${ms}ms`);
    end(0);
  } catch (err) {
    log(`✖ ${cmd} failed:\n`, err instanceof Error ? err.message : err);
    end(1);
  }
}

main().catch((e) => {
  console.error(e);
  end(1);
});
