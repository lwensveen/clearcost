import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      out.push(...listFiles(full));
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function extractScopes(text: string): Set<string> {
  const re = /tasks:[a-z0-9:-]+/gi;
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    if (m[0]) out.add(m[0]);
  }
  return out;
}

const tasksDir = join(repoRoot, 'apps', 'api', 'src', 'modules', 'tasks');
const taskFiles = listFiles(tasksDir).filter((p) => p.endsWith('.ts'));
const codeScopes = new Set<string>();

for (const file of taskFiles) {
  const text = readFileSync(file, 'utf8');
  for (const scope of extractScopes(text)) {
    codeScopes.add(scope);
  }
}

const docsFiles = [join(repoRoot, 'README.md'), join(repoRoot, 'apps', 'api', 'README.md')];
const docsScopes = new Set<string>();

for (const file of docsFiles) {
  const text = readFileSync(file, 'utf8');
  for (const scope of extractScopes(text)) {
    docsScopes.add(scope);
  }
}

const missing = [...docsScopes].filter((s) => !codeScopes.has(s));

if (missing.length) {
  console.error('Docs reference tasks scopes missing from code:');
  for (const scope of missing.sort()) {
    console.error(`- ${scope}`);
  }
  process.exit(1);
}

console.log(`Docs scopes OK (${docsScopes.size} scopes).`);
