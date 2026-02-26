import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  OPTIONAL_FALLBACK_SOURCE_KEYS,
} from '../apps/api/src/lib/source-registry/defaults.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dutiesTasksDir = join(repoRoot, 'apps', 'api', 'src', 'modules', 'tasks', 'duties');

const BN_KH_LA_MM_SLUGS = ['bn', 'kh', 'la', 'mm'] as const;
const DYNAMIC_DUTY_SOURCE_KEYS: Record<string, string[]> = {
  mfnKey: BN_KH_LA_MM_SLUGS.map((slug) => `duties.${slug}.official.mfn_excel`),
  ftaKey: BN_KH_LA_MM_SLUGS.map((slug) => `duties.${slug}.official.fta_excel`),
};

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      out.push(...listFiles(full));
      continue;
    }
    if (stat.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function extractDutyRouteSourceKeys(files: ReadonlyArray<string>): {
  sourceKeys: Set<string>;
  unresolvedVariables: string[];
} {
  const sourceKeys = new Set<string>();
  const unresolvedVariables = new Set<string>();

  for (const file of files) {
    const text = readFileSync(file, 'utf8');

    for (const match of text.matchAll(/sourceKey:\s*'([^']+)'/g)) {
      const sourceKey = match[1]?.trim();
      if (sourceKey) sourceKeys.add(sourceKey);
    }

    for (const match of text.matchAll(/sourceKey:\s*`([^`]+)`/g)) {
      const sourceKey = match[1]?.trim();
      if (!sourceKey) continue;
      if (sourceKey.includes('${')) continue;
      sourceKeys.add(sourceKey);
    }

    for (const match of text.matchAll(/sourceKey:\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const token = match[1];
      if (!token) continue;
      const expanded = DYNAMIC_DUTY_SOURCE_KEYS[token];
      if (!expanded) {
        unresolvedVariables.add(`${file}: ${token}`);
        continue;
      }
      for (const sourceKey of expanded) sourceKeys.add(sourceKey);
    }
  }

  return { sourceKeys, unresolvedVariables: [...unresolvedVariables].sort() };
}

function diff(source: ReadonlySet<string>, target: ReadonlySet<string>): string[] {
  return [...source].filter((value) => !target.has(value)).sort();
}

const dutyTaskFiles = listFiles(dutiesTasksDir);
const { sourceKeys: routeSourceKeys, unresolvedVariables } =
  extractDutyRouteSourceKeys(dutyTaskFiles);
const knownDutySourceKeys = new Set([
  ...OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  ...OPTIONAL_FALLBACK_SOURCE_KEYS,
]);

const errors: string[] = [];

if (routeSourceKeys.size === 0) {
  errors.push('No duty route sourceKey values found.');
}

if (unresolvedVariables.length > 0) {
  errors.push(
    `Duty route sourceKey variables could not be resolved statically: ${unresolvedVariables.join(
      ', '
    )}`
  );
}

const unknownRouteSourceKeys = diff(routeSourceKeys, knownDutySourceKeys);
if (unknownRouteSourceKeys.length > 0) {
  errors.push(
    `Duty route source keys missing from required source manifest: ${unknownRouteSourceKeys.join(
      ', '
    )}`
  );
}

if (errors.length > 0) {
  console.error('Duty source key validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `duty source key alignment OK (routeSourceKeys=${routeSourceKeys.size}, knownDutySourceKeys=${knownDutySourceKeys.size})`
);
