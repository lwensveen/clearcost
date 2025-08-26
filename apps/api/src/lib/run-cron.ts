#!/usr/bin/env bun
import 'dotenv/config';
import { commands } from './cron/registry.js';

const task = process.argv[2];
const args = process.argv.slice(3);

if (!task || !commands[task]) {
  console.error(
    `Usage:
  bun run src/lib/run-cron.ts <task>

Tasks:
  ${Object.keys(commands).sort().join('\n  ')}
`
  );
  process.exit(1);
}

commands[task](args).catch((e) => {
  console.error(e);
  process.exit(1);
});
