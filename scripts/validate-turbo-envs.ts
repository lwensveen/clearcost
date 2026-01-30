import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const turboPath = join(repoRoot, 'turbo.json');
const listEnvsPath = join(repoRoot, 'scripts', 'list-envs.js');

function readTurboEnv(): Set<string> {
  const data = JSON.parse(readFileSync(turboPath, 'utf8'));
  const env = data?.tasks?.build?.env ?? [];
  return new Set(Array.isArray(env) ? env : []);
}

function listUsedEnvs(group: string): Set<string> {
  const out = execSync(`node ${listEnvsPath} --groups=${group} --names`, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const keys = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  return new Set(keys);
}

function diffMissing(used: Set<string>, turboEnv: Set<string>): string[] {
  return [...used].filter((k) => !turboEnv.has(k)).sort();
}

const turboEnv = readTurboEnv();
const apiEnv = listUsedEnvs('apps/api');
const webEnv = listUsedEnvs('apps/web');
const docsEnv = listUsedEnvs('apps/docs');

const missingApi = diffMissing(apiEnv, turboEnv);
const missingWeb = diffMissing(webEnv, turboEnv);
const missingDocs = diffMissing(docsEnv, turboEnv);

if (missingApi.length || missingWeb.length || missingDocs.length) {
  if (missingApi.length) {
    console.error('Missing in turbo.json (apps/api):');
    for (const k of missingApi) console.error(`- ${k}`);
  }
  if (missingWeb.length) {
    console.error('Missing in turbo.json (apps/web):');
    for (const k of missingWeb) console.error(`- ${k}`);
  }
  if (missingDocs.length) {
    console.error('Missing in turbo.json (apps/docs):');
    for (const k of missingDocs) console.error(`- ${k}`);
  }
  process.exit(1);
}

console.log('turbo env list: OK');
