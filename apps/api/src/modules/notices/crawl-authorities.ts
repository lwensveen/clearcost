import { parse } from 'node-html-parser';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

export type CrawlOptions = {
  startUrls: string[];
  maxDepth?: number; // default 1
  concurrency?: number; // default 4
  includeHints?: string[]; // e.g., ['pdf','tariff','税率','公告','通知']
  excludeHints?: string[]; // e.g., ['archive','旧','历史']
  outDir?: string; // optional: if provided, saves PDFs there
  userAgent?: string; // UA override
};

export type CrawlFile = { url: string; path?: string; size?: number };
export type CrawlSummary = {
  ok: true;
  found: number;
  downloaded: number;
  skipped: number;
  files: CrawlFile[];
};

const DEFAULT_UA: string =
  process.env.NOTICES_USER_AGENT ??
  'clearcost-notices/1.0 (+https://clearcost.io; contact: support@clearcost.io)';

function sameHost(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.host === ub.host;
  } catch {
    return false;
  }
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 12);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function looksLikeNoticePdf(
  url: string,
  includeHints: string[] = [],
  excludeHints: string[] = []
): boolean {
  const u = url.toLowerCase();
  if (!u.endsWith('.pdf')) return false;
  if (excludeHints.length && excludeHints.some((h) => u.includes(h))) return false;
  if (!includeHints.length) return true;
  return includeHints.some((h) => u.includes(h));
}

async function fetchHtml(url: string, userAgent?: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': userAgent ?? DEFAULT_UA },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function fetchBin(url: string, userAgent?: string): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': userAgent ?? DEFAULT_UA },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function* bfs(startUrl: string, maxDepth: number, userAgent?: string) {
  const seen = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

  while (queue.length) {
    const next = queue.shift()!;
    const currentUrl = next.url;
    const depth = next.depth;

    if (seen.has(currentUrl)) continue;
    seen.add(currentUrl);

    let html = '';
    try {
      html = await fetchHtml(currentUrl, userAgent);
    } catch {
      continue;
    }
    yield { url: currentUrl, depth, html };

    if (depth >= maxDepth) continue;

    const root = parse(html);
    for (const anchor of root.querySelectorAll('a')) {
      const href = anchor.getAttribute('href');
      if (!href) continue; // guards undefined/null
      const abs = absolutize(href, currentUrl);
      if (!sameHost(startUrl, abs)) continue;
      if (/\.(pdf|zip|xlsx?)$/i.test(abs)) continue; // don’t enqueue assets
      queue.push({ url: abs, depth: depth + 1 });
    }
  }
}

export async function crawlAuthorityPdfs(opts: CrawlOptions): Promise<CrawlSummary> {
  const startUrls = Array.from(new Set(opts.startUrls)).filter(Boolean);
  const maxDepth = Math.max(0, opts.maxDepth ?? Number(process.env.NOTICES_MAX_DEPTH ?? 1));
  const concurrency = Math.max(1, opts.concurrency ?? Number(process.env.NOTICES_CONCURRENCY ?? 4));
  const includeHints =
    opts.includeHints ??
    (process.env.NOTICES_INCLUDE_HINTS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const excludeHints =
    opts.excludeHints ??
    (process.env.NOTICES_EXCLUDE_HINTS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const outDir: string | undefined = opts.outDir;

  if (outDir) await mkdir(outDir, { recursive: true });

  // Discover PDFs
  const pdfs = new Set<string>();
  for (const seed of startUrls) {
    for await (const page of bfs(seed, maxDepth, opts.userAgent)) {
      const root = parse(page.html);
      for (const anchor of root.querySelectorAll('a')) {
        const href = anchor.getAttribute('href');
        if (!href) continue;
        const abs = absolutize(href, page.url);
        if (!sameHost(seed, abs)) continue;
        if (looksLikeNoticePdf(abs, includeHints, excludeHints)) pdfs.add(abs);
      }
    }
  }

  // Download (optional)
  const urls = [...pdfs];
  let skipped = 0;
  const files: CrawlFile[] = [];

  const hasOutputDir = typeof outDir === 'string' && outDir.length > 0;
  const outputDir = outDir;

  async function worker() {
    for (;;) {
      const target = urls.pop();
      if (!target) break;

      try {
        if (!hasOutputDir || !outputDir) {
          files.push({ url: target });
          continue;
        }

        const baseNameGuess = basename(new URL(target).pathname).replace(/\.pdf$/i, '');
        const fileName = `${slugify(baseNameGuess)}-${sha1(target)}.pdf`;
        const fullPath = join(outputDir, fileName);
        const buf = await fetchBin(target, opts.userAgent);
        await writeFile(fullPath, buf);
        files.push({ url: target, path: fullPath, size: buf.length });
      } catch {
        skipped++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { ok: true, found: urls.length, downloaded: files.length, skipped, files };
}
