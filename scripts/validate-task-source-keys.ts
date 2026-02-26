import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_REQUIRED_SOURCE_KEYS } from '../apps/api/src/lib/source-registry/defaults.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tasksDir = join(repoRoot, 'apps', 'api', 'src', 'modules', 'tasks');

const BN_KH_LA_MM_SLUGS = ['bn', 'kh', 'la', 'mm'] as const;
const DYNAMIC_SOURCE_KEY_IDENTIFIERS: Record<string, string[]> = {
  mfnKey: BN_KH_LA_MM_SLUGS.map((slug) => `duties.${slug}.official.mfn_excel`),
  ftaKey: BN_KH_LA_MM_SLUGS.map((slug) => `duties.${slug}.official.fta_excel`),
};

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      out.push(...listRouteFiles(full));
      continue;
    }
    if (stat.isFile() && full.endsWith('-routes.ts')) out.push(full);
  }
  return out.sort();
}

function extractImportMetaBlocks(text: string): string[] {
  const blocks: string[] = [];
  const importMetaToken = 'importMeta:';
  let searchFrom = 0;

  while (true) {
    const metaIndex = text.indexOf(importMetaToken, searchFrom);
    if (metaIndex === -1) break;

    const openBraceIndex = text.indexOf('{', metaIndex + importMetaToken.length);
    if (openBraceIndex === -1) break;

    let depth = 0;
    let closeBraceIndex = -1;
    for (let i = openBraceIndex; i < text.length; i++) {
      const char = text[i];
      if (char === '{') depth++;
      if (char === '}') depth--;
      if (depth === 0) {
        closeBraceIndex = i;
        break;
      }
    }

    if (closeBraceIndex === -1) break;

    blocks.push(text.slice(openBraceIndex, closeBraceIndex + 1));
    searchFrom = closeBraceIndex + 1;
  }

  return blocks;
}

function extractSourceKeysFromImportMeta(
  filePath: string,
  text: string
): { sourceKeys: Set<string>; unresolvedIdentifiers: string[] } {
  const sourceKeys = new Set<string>();
  const unresolvedIdentifiers = new Set<string>();
  const blocks = extractImportMetaBlocks(text);

  for (const block of blocks) {
    if (!block.includes('sourceKey:')) continue;

    for (const match of block.matchAll(/sourceKey:\s*'([^']+)'/g)) {
      const sourceKey = match[1]?.trim();
      if (sourceKey) sourceKeys.add(sourceKey);
    }

    for (const match of block.matchAll(/sourceKey:\s*`([^`]+)`/g)) {
      const sourceKey = match[1]?.trim();
      if (!sourceKey) continue;
      if (sourceKey.includes('${')) continue;
      sourceKeys.add(sourceKey);
    }

    for (const match of block.matchAll(/sourceKey:\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const identifier = match[1];
      if (!identifier) continue;
      const expanded = DYNAMIC_SOURCE_KEY_IDENTIFIERS[identifier];
      if (!expanded) {
        unresolvedIdentifiers.add(`${filePath}: ${identifier}`);
        continue;
      }
      for (const sourceKey of expanded) sourceKeys.add(sourceKey);
    }
  }

  return { sourceKeys, unresolvedIdentifiers: [...unresolvedIdentifiers].sort() };
}

function diff(source: ReadonlySet<string>, target: ReadonlySet<string>): string[] {
  return [...source].filter((value) => !target.has(value)).sort();
}

const routeFiles = listRouteFiles(tasksDir);
const routeSourceKeys = new Set<string>();
const unresolvedIdentifiers = new Set<string>();

for (const filePath of routeFiles) {
  const text = readFileSync(filePath, 'utf8');
  const parsed = extractSourceKeysFromImportMeta(filePath, text);
  for (const sourceKey of parsed.sourceKeys) routeSourceKeys.add(sourceKey);
  for (const unresolved of parsed.unresolvedIdentifiers) unresolvedIdentifiers.add(unresolved);
}

const knownSourceKeys = new Set(ALL_REQUIRED_SOURCE_KEYS);
const errors: string[] = [];

if (routeSourceKeys.size === 0) {
  errors.push('No importMeta sourceKey values found in task routes.');
}

if (unresolvedIdentifiers.size > 0) {
  errors.push(
    `Task route sourceKey identifiers could not be resolved statically: ${[...unresolvedIdentifiers]
      .sort()
      .join(', ')}`
  );
}

const unknownRouteSourceKeys = diff(routeSourceKeys, knownSourceKeys);
if (unknownRouteSourceKeys.length > 0) {
  errors.push(
    `Task route source keys missing from required source manifest: ${unknownRouteSourceKeys.join(
      ', '
    )}`
  );
}

if (errors.length > 0) {
  console.error('Task source key validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `task source key alignment OK (routeSourceKeys=${routeSourceKeys.size}, knownSourceKeys=${knownSourceKeys.size}, routeFiles=${routeFiles.length})`
);
