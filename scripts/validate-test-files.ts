import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps', 'packages'];

const legacyPattern = /\.(test|spec)\.[cm]?[jt]sx?$/;
const requiredPattern = /\.(unit|int)\.test\.[cm]?[jt]sx?$/;
const orphanSuffixPattern = /\.(unit|int)\.[cm]?[jt]sx?$/;

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(full);
  }
}

const files: string[] = [];
for (const root of ROOTS) walk(root, files);

const invalid: string[] = [];
for (const file of files) {
  if (legacyPattern.test(file) && !requiredPattern.test(file)) invalid.push(file);
  if (orphanSuffixPattern.test(file) && !requiredPattern.test(file)) invalid.push(file);
}

if (invalid.length > 0) {
  console.error('Invalid test filenames detected. Use .unit.test.ts or .int.test.ts');
  for (const file of [...new Set(invalid)].sort()) console.error(`- ${file}`);
  process.exit(1);
}

console.log('test filename conventions: OK');
