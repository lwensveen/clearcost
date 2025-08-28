#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function gitTrackedFiles() {
  try {
    cp.execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    const out = cp.execSync('git ls-files -z', { encoding: 'utf8' });
    return out.split('\0').filter(Boolean);
  } catch {
    // Fallback: walk filesystem (slower). These are common build dirs to skip.
    const ignore = new Set([
      'node_modules',
      '.turbo',
      'dist',
      '.next',
      '.git',
      '.vercel',
      'coverage',
      'out',
      'build',
      '.cache',
    ]);
    const files = [];
    (function walk(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ignore.has(ent.name)) continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else files.push(p);
      }
    })('.');
    return files;
  }
}

// ---------- CLI ----------
const args = process.argv.slice(2);
const opts = {
  names: args.includes('--names'),
  json: args.includes('--json'),
  union: args.includes('--union'),
  label: 'path', // 'path' | 'name'
  groups: [], // restrict to these group labels/prefixes (relative paths)
  exclude: null,
};

for (const a of args) {
  if (a.startsWith('--label=')) {
    const v = a.split('=')[1];
    if (v === 'name' || v === 'path') opts.label = v;
  } else if (a.startsWith('--groups=')) {
    opts.groups = a
      .split('=')[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (a.startsWith('--exclude=')) {
    const pat = a.replace(/^--exclude=/, '');
    opts.exclude = new RegExp(pat);
  }
}

// ---------- Grouping (by nearest package.json) ----------
const pkgCache = new Map(); // dir -> { dir, name, label }
function findPackageRoot(startFile) {
  let dir = path.dirname(startFile);
  if (pkgCache.has(dir)) return pkgCache.get(dir);
  const root = path.resolve('.');
  while (true) {
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      let name = null;
      try {
        name = JSON.parse(fs.readFileSync(pj, 'utf8')).name || null;
      } catch {}
      const rel = path.relative(root, dir) || '.';
      const label = opts.label === 'name' ? name || rel || '.' : rel || '.';
      const info = { dir, name, label };
      pkgCache.set(dir, info);
      return info;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const rel = path.relative(root, path.dirname(startFile)) || '.';
  const info = { dir: path.dirname(startFile), name: null, label: rel || '.' };
  pkgCache.set(info.dir, info);
  return info;
}

function groupForFile(file) {
  const info = findPackageRoot(file);
  const label = info.label.replace(/\\/g, '/');
  if (opts.groups.length) {
    const match = opts.groups.some((g) => label === g || label.startsWith(g + '/'));
    return match ? label : null;
  }
  return label;
}

// ---------- Scanners ----------
const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cts', '.mts']);
const shellExts = new Set(['.sh', '.bash', '.zsh']);
const yamlExts = new Set(['.yml', '.yaml']);

const rx = {
  procDot: /\bprocess(?:\?\.)?\.env(?:\?\.)?\.([A-Za-z_][A-Za-z0-9_]*)/g,
  procBracket: /\bprocess(?:\?\.)?\.env(?:\?\.)?\[\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]\s*\]/g,
  procDestructure: /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*process(?:\?\.)?\.env\b/g,
  importMetaDot:
    /\bimport\.meta\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]\s*\])/g,
  envLine: /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
  shellVar: /(?<![\w$])\$\{?([A-Z][A-Z0-9_]+)\}?/g,
  ghSecrets: /\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
  ghVars: /\{\{\s*vars\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
};

const union = new Map(); // key -> Set(tags)
const groups = new Map(); // label -> Map(key -> Set(tags))
const KEY_OK = /^[A-Z_][A-Z0-9_]*$/;

function add(tag, key, label) {
  if (!key || !KEY_OK.test(key)) return;
  if (opts.exclude && opts.exclude.test(key)) return;

  if (label) {
    if (!groups.has(label)) groups.set(label, new Map());
    const g = groups.get(label);
    if (!g.has(key)) g.set(key, new Set());
    g.get(key).add(tag);
  }

  if (!union.has(key)) union.set(key, new Set());
  union.get(key).add(tag);
}

function scanCode(text, label) {
  for (const m of text.matchAll(rx.procDot)) add('code', m[1], label);
  for (const m of text.matchAll(rx.procBracket)) add('code', m[1], label);
  for (const m of text.matchAll(rx.importMetaDot)) add('code', m[1] || m[2], label);
  for (const m of text.matchAll(rx.procDestructure)) {
    const inner = m[1];
    for (const raw of inner.split(',')) {
      let tok = raw.trim();
      if (!tok || tok.startsWith('...')) continue;
      tok = tok.split(':')[0];
      tok = tok.split('=')[0];
      tok = tok.trim();
      add('code', tok, label);
    }
  }
}
function scanEnvFile(text, label) {
  for (const line of text.split(/\r?\n/)) {
    const m = rx.envLine.exec(line);
    if (m) add('envfile', m[1], label);
  }
}
function scanShell(text, label) {
  for (const m of text.matchAll(rx.shellVar)) add('shell', m[1], label);
}
function scanYaml(text, label) {
  for (const m of text.matchAll(rx.ghSecrets)) add('gh-secrets', m[1], label);
  for (const m of text.matchAll(rx.ghVars)) add('gh-vars', m[1], label);
}

// ---------- Walk files ----------
const files = gitTrackedFiles();
for (const file of files) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    continue;
  }
  if (buf.includes(0)) continue; // skip binaries
  const label = groupForFile(file);
  if (!label) continue; // filtered out by --groups
  const text = buf.toString('utf8');

  const base = path.basename(file);
  const ext = path.extname(file);

  if (base.startsWith('.env')) scanEnvFile(text, label);
  if (codeExts.has(ext)) scanCode(text, label);
  if (shellExts.has(ext) || base === 'Dockerfile' || base.startsWith('Dockerfile.'))
    scanShell(text, label);
  if (yamlExts.has(ext) || file.startsWith('.github/workflows/')) scanYaml(text, label);
}

// ---------- Output ----------
function sortedKeys(map) {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
}
function tagsStr(set) {
  return Array.from(set).join(', ');
}

if (opts.json) {
  const payload = {};
  for (const [label, g] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    payload[label] = sortedKeys(g).map((k) => ({ key: k, tags: Array.from(g.get(k)) }));
  }
  if (opts.union) {
    payload.__union__ = sortedKeys(union).map((k) => ({ key: k, tags: Array.from(union.get(k)) }));
  }
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// human-readable
for (const [label, g] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
  const keys = sortedKeys(g);
  if (!keys.length) continue;
  console.log(`# ${label}`);
  if (opts.names) {
    for (const k of keys) console.log(k);
  } else {
    for (const k of keys) console.log(k.padEnd(34) + ' # ' + tagsStr(g.get(k)));
  }
  console.log('');
}

if (opts.union) {
  const keys = sortedKeys(union);
  if (keys.length) {
    console.log('# __union__ (all groups)');
    if (opts.names) {
      for (const k of keys) console.log(k);
    } else {
      for (const k of keys) console.log(k.padEnd(34) + ' # ' + tagsStr(union.get(k)));
    }
  }
}
