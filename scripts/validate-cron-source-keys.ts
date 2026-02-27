import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const commandsDir = join(repoRoot, 'apps', 'api', 'src', 'lib', 'cron', 'commands');

function listCommandFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      out.push(...listCommandFiles(full));
      continue;
    }
    if (
      stat.isFile() &&
      full.endsWith('.ts') &&
      !full.endsWith('.unit.test.ts') &&
      !full.endsWith('.int.test.ts')
    ) {
      out.push(full);
    }
  }
  return out.sort();
}

function isWhitespace(char: string | undefined): boolean {
  return Boolean(char && /\s/.test(char));
}

function firstCallObjectArg(text: string, withRunIndex: number): string | null {
  let i = withRunIndex + 'withRun'.length;

  while (i < text.length && isWhitespace(text[i])) i++;

  if (text[i] === '<') {
    let angleDepth = 0;
    for (; i < text.length; i++) {
      const char = text[i];
      if (char === '<') angleDepth++;
      if (char === '>') {
        angleDepth--;
        if (angleDepth === 0) {
          i++;
          break;
        }
      }
    }
  }

  while (i < text.length && isWhitespace(text[i])) i++;
  if (text[i] !== '(') return null;
  i++;

  while (i < text.length && isWhitespace(text[i])) i++;
  if (text[i] !== '{') return null;

  const objectStart = i;
  let braceDepth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (; i < text.length; i++) {
    const char = text[i] ?? '';

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') braceDepth++;
    if (char === '}') {
      braceDepth--;
      if (braceDepth === 0) return text.slice(objectStart, i + 1);
    }
  }

  return null;
}

function extractNonOpsMissingSourceKeys(filePath: string, text: string): string[] {
  const missing: string[] = [];

  let searchFrom = 0;
  while (true) {
    const withRunIndex = text.indexOf('withRun', searchFrom);
    if (withRunIndex === -1) break;

    const objectArg = firstCallObjectArg(text, withRunIndex);
    if (!objectArg) {
      searchFrom = withRunIndex + 'withRun'.length;
      continue;
    }

    const hasSourceKey = /\bsourceKey\b/.test(objectArg);
    const jobs = [...objectArg.matchAll(/job\s*:\s*['`]([^'`]+)['`]/g)].map((match) =>
      String(match[1] ?? '').trim()
    );

    if (!hasSourceKey) {
      if (jobs.length === 0) {
        missing.push(`${filePath}: <unknown-job>`);
      } else {
        for (const job of jobs) {
          if (!job.toLowerCase().startsWith('ops:')) {
            missing.push(`${filePath}: ${job}`);
          }
        }
      }
    }

    searchFrom = withRunIndex + 'withRun'.length;
  }

  return [...new Set(missing)].sort();
}

const commandFiles = listCommandFiles(commandsDir);
const missingSourceKeyJobs = new Set<string>();

for (const filePath of commandFiles) {
  const text = readFileSync(filePath, 'utf8');
  const missing = extractNonOpsMissingSourceKeys(filePath, text);
  for (const m of missing) missingSourceKeyJobs.add(m);
}

if (missingSourceKeyJobs.size > 0) {
  console.error('Cron source key validation failed:');
  console.error(
    `- Cron withRun jobs missing sourceKey for non-ops jobs: ${[...missingSourceKeyJobs]
      .sort()
      .join(', ')}`
  );
  process.exit(1);
}

console.log(`cron source key alignment OK (commandFiles=${commandFiles.length})`);
