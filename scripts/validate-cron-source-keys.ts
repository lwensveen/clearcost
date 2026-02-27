import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_KNOWN_SOURCE_KEYS } from '../apps/api/src/lib/source-registry/defaults.ts';
import { DUTY_COUNTRY_SCAFFOLD_SOURCE_KEYS } from '../apps/api/src/lib/cron/commands/duties/duties-country-scaffold-data.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const commandsDir = join(repoRoot, 'apps', 'api', 'src', 'lib', 'cron', 'commands');
const DUTY_COUNTRY_SCAFFOLD_MFN_SOURCE_KEYS = DUTY_COUNTRY_SCAFFOLD_SOURCE_KEYS.filter((key) =>
  key.endsWith('.mfn_excel')
);
const DUTY_COUNTRY_SCAFFOLD_FTA_SOURCE_KEYS = DUTY_COUNTRY_SCAFFOLD_SOURCE_KEYS.filter((key) =>
  key.endsWith('.fta_excel')
);
const SOURCE_KEY_IDENTIFIER_MAP: Record<string, string[]> = {
  PROGRAMS_MEMBERS_SOURCE_KEY: ['duties.us.trade_programs.members_csv'],
  countryMfnSourceKey: DUTY_COUNTRY_SCAFFOLD_MFN_SOURCE_KEYS,
  countryFtaSourceKey: DUTY_COUNTRY_SCAFFOLD_FTA_SOURCE_KEYS,
};

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

function extractConstStringAssignments(text: string): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  for (const match of text.matchAll(
    /\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(["'`])([^"'`$]+)\2/g
  )) {
    const name = match[1];
    const value = match[3]?.trim();
    if (!name || !value) continue;
    const existing = byName.get(name);
    if (existing) {
      existing.push(value);
      continue;
    }
    byName.set(name, [value]);
  }
  return byName;
}

function extractNonOpsWithRunMetadata(
  filePath: string,
  text: string
): {
  sourceKeys: Set<string>;
  unresolvedIdentifiers: string[];
  missingSourceKeyJobs: string[];
} {
  const sourceKeys = new Set<string>();
  const unresolvedIdentifiers = new Set<string>();
  const missingSourceKeyJobs = new Set<string>();
  const constValues = extractConstStringAssignments(text);

  const parseJobs = (block: string): string[] => {
    const jobs: string[] = [];
    for (const match of block.matchAll(/job\s*:\s*['`]([^'`]+)['`]/g)) {
      const job = String(match[1] ?? '').trim();
      if (job) jobs.push(job);
    }
    return jobs;
  };

  const parseSourceKeys = (block: string): string[] => {
    const extracted: string[] = [];

    for (const match of block.matchAll(/sourceKey\s*:\s*'([^']+)'/g)) {
      const sourceKey = String(match[1] ?? '').trim();
      if (sourceKey) extracted.push(sourceKey);
    }

    for (const match of block.matchAll(/sourceKey\s*:\s*"([^"]+)"/g)) {
      const sourceKey = String(match[1] ?? '').trim();
      if (sourceKey) extracted.push(sourceKey);
    }

    for (const match of block.matchAll(/sourceKey\s*:\s*`([^`]+)`/g)) {
      const sourceKey = String(match[1] ?? '').trim();
      if (!sourceKey) continue;
      if (sourceKey.includes('${')) continue;
      extracted.push(sourceKey);
    }

    for (const match of block.matchAll(/sourceKey\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const identifier = match[1];
      if (!identifier) continue;
      if (identifier === 'sourceKey') continue; // runtime-supplied explicit sourceKey

      const mappedValues = SOURCE_KEY_IDENTIFIER_MAP[identifier];
      if (mappedValues && mappedValues.length > 0) {
        extracted.push(...mappedValues);
        continue;
      }

      const localValues = constValues.get(identifier);
      if (localValues && localValues.length > 0) {
        extracted.push(...localValues);
        continue;
      }

      unresolvedIdentifiers.add(`${filePath}: ${identifier}`);
    }

    return extracted;
  };

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
    const jobs = parseJobs(objectArg);

    if (!hasSourceKey) {
      if (jobs.length === 0) {
        missingSourceKeyJobs.add(`${filePath}: <unknown-job>`);
      } else {
        for (const job of jobs) {
          if (!job.toLowerCase().startsWith('ops:')) {
            missingSourceKeyJobs.add(`${filePath}: ${job}`);
          }
        }
      }
      searchFrom = withRunIndex + 'withRun'.length;
      continue;
    }

    for (const sourceKey of parseSourceKeys(objectArg)) {
      sourceKeys.add(sourceKey);
    }

    searchFrom = withRunIndex + 'withRun'.length;
  }

  return {
    sourceKeys,
    unresolvedIdentifiers: [...unresolvedIdentifiers].sort(),
    missingSourceKeyJobs: [...missingSourceKeyJobs].sort(),
  };
}

const commandFiles = listCommandFiles(commandsDir);
const missingSourceKeyJobs = new Set<string>();
const unresolvedIdentifiers = new Set<string>();
const commandSourceKeys = new Set<string>();

for (const filePath of commandFiles) {
  const text = readFileSync(filePath, 'utf8');
  const parsed = extractNonOpsWithRunMetadata(filePath, text);
  for (const m of parsed.missingSourceKeyJobs) missingSourceKeyJobs.add(m);
  for (const unresolved of parsed.unresolvedIdentifiers) unresolvedIdentifiers.add(unresolved);
  for (const sourceKey of parsed.sourceKeys) commandSourceKeys.add(sourceKey);
}

const knownSourceKeys = new Set(ALL_KNOWN_SOURCE_KEYS);
const unknownCommandSourceKeys = [...commandSourceKeys]
  .filter((sourceKey) => !knownSourceKeys.has(sourceKey))
  .sort();

const errors: string[] = [];

if (commandSourceKeys.size === 0) {
  errors.push('No withRun sourceKey values found in cron command files.');
}

if (missingSourceKeyJobs.size > 0) {
  errors.push(
    `Cron withRun jobs missing sourceKey for non-ops jobs: ${[...missingSourceKeyJobs]
      .sort()
      .join(', ')}`
  );
}

if (unresolvedIdentifiers.size > 0) {
  errors.push(
    `Cron sourceKey identifiers could not be resolved statically: ${[...unresolvedIdentifiers]
      .sort()
      .join(', ')}`
  );
}

if (unknownCommandSourceKeys.length > 0) {
  errors.push(
    `Cron source keys missing from known source manifest: ${unknownCommandSourceKeys.join(', ')}`
  );
}

if (errors.length > 0) {
  console.error('Cron source key validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `cron source key alignment OK (commandFiles=${commandFiles.length}, commandSourceKeys=${commandSourceKeys.size}, knownSourceKeys=${knownSourceKeys.size})`
);
