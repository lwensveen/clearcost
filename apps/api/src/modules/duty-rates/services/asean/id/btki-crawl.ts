import { parse } from 'node-html-parser';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

type CrawlOpts = {
  /** Seed page to start from (required). Example: https://repository.beacukai.go.id/… */
  startUrl: string;
  /** Max depth to follow links from the seed (default 1). */
  maxDepth?: number;
  /** Concurrency for fetches (default 4). */
  concurrency?: number;
  /** Where to write the PDFs (default TMP or env.ID_BTKI_OUT_DIR). */
  outDir?: string;
  /** Optional allowlist for href substring matches (case-insensitive). */
  includeHints?: string[];
  /** Optional denylist for href substring matches (case-insensitive). */
  excludeHints?: string[];
};

export type CrawlResult = {
  ok: true;
  startUrl: string;
  outDir: string;
  found: number;
  downloaded: number;
  skipped: number;
  files: { url: string; path: string; size: number }[];
};

const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  'clearcost-bot/1.0 (+https://clearcost.io; tariff research; contact: support@clearcost.io)';

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sameHost(urlA: string, urlB: string) {
  try {
    const parsedA = new URL(urlA);
    const parsedB = new URL(urlB);
    return parsedA.host === parsedB.host;
  } catch {
    return false;
  }
}

function absolutizeHref(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function sha1Hex(text: string) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function slugifySegment(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function looksLikeBtkiPdf(pdfUrl: string, hints: string[] = []) {
  const urlLower = pdfUrl.toLowerCase();
  const isPdf = urlLower.endsWith('.pdf');
  if (!isPdf) return false;

  // Helpful common hints around BTKI / Chapters / PMK documents
  const defaultTerms = ['btki', 'bab', 'chapter', 'lampiran', 'pmk', 'hs', 'tarif'];
  const terms = hints.length ? hints : defaultTerms;
  return terms.some((term) => urlLower.includes(term));
}

async function fetchHtmlPage(url: string) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return response.text();
}

async function fetchBinary(url: string) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function* bfsPages(startUrl: string, maxDepth: number) {
  const seenUrls = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

  while (queue.length) {
    const nextItem = queue.shift()!;
    const pageUrl = nextItem.url;
    const pageDepth = nextItem.depth;

    if (seenUrls.has(pageUrl)) continue;
    seenUrls.add(pageUrl);

    let html = '';
    try {
      html = await fetchHtmlPage(pageUrl);
    } catch {
      // ignore pages we can't fetch
      continue;
    }
    yield { url: pageUrl, depth: pageDepth, html };

    if (pageDepth >= maxDepth) continue;

    const root = parse(html);
    const anchorElements = root.querySelectorAll('a');
    for (const anchorElement of anchorElements) {
      const href = anchorElement.getAttribute('href');
      if (!href) continue;
      const absolute = absolutizeHref(href, pageUrl);
      if (!sameHost(startUrl, absolute)) continue;
      // Only enqueue html-like links
      if (/\.(pdf|zip|xlsx?)$/i.test(absolute)) continue;
      queue.push({ url: absolute, depth: pageDepth + 1 });
    }
  }
}

export async function crawlBtkiPdfs(options: CrawlOpts): Promise<CrawlResult> {
  if (!options?.startUrl) throw new Error('startUrl is required');

  const startUrl = options.startUrl;
  const maxDepth = Math.max(0, options.maxDepth ?? 1);
  const outDir = options.outDir ?? process.env.ID_BTKI_OUT_DIR ?? '/tmp/cc-btki';
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const includeHintsLower = (options.includeHints ?? []).map((text) => text.toLowerCase());
  const excludeHintsLower = (options.excludeHints ?? []).map((text) => text.toLowerCase());

  await mkdir(outDir, { recursive: true });

  // 1) Discover
  const pdfUrlSet = new Set<string>();
  for await (const page of bfsPages(startUrl, maxDepth)) {
    const root = parse(page.html);
    for (const anchorElement of root.querySelectorAll('a')) {
      const href = anchorElement.getAttribute('href');
      if (!href) continue;

      const absolute = absolutizeHref(href, page.url);
      if (!sameHost(startUrl, absolute)) continue;
      if (!absolute.toLowerCase().endsWith('.pdf')) continue;
      if (!looksLikeBtkiPdf(absolute, includeHintsLower)) continue;
      if (
        excludeHintsLower.length &&
        excludeHintsLower.some((hint) => absolute.toLowerCase().includes(hint))
      ) {
        continue;
      }
      pdfUrlSet.add(absolute);
    }
  }

  // 2) Download with a small pool
  const discoveredUrls = Array.from(pdfUrlSet);
  const files: { url: string; path: string; size: number }[] = [];
  let nextIndex = 0;
  let skippedCount = 0;

  function getNextUrl(): string | null {
    if (nextIndex >= discoveredUrls.length) return null;
    const nextUrl = discoveredUrls[nextIndex]!;
    nextIndex += 1;
    return nextUrl;
  }

  async function worker() {
    while (true) {
      const currentUrl = getNextUrl();
      if (!currentUrl) break;

      try {
        const fileNameGuess = basename(new URL(currentUrl).pathname);
        const nameHint = fileNameGuess.replace(/\.pdf$/i, '');

        // Try to capture "chapter-xx" or "bab-xx" if present; fallback to a hash
        const chapterMatch =
          nameHint.match(/(bab|chapter)[-_ ]?(\d{1,2})/i) ??
          nameHint.match(/hs[-_ ]?(\d{2})/i) ??
          null;

        const chapterToken = (chapterMatch ? (chapterMatch[2] ?? chapterMatch[1]) : null) ?? null;

        const canonicalName =
          chapterToken != null
            ? `btki-chapter-${String(chapterToken).padStart(2, '0')}.pdf`
            : `btki-${slugifySegment(nameHint)}-${sha1Hex(currentUrl)}.pdf`;

        const filePath = join(outDir, canonicalName);

        const buffer = await fetchBinary(currentUrl);
        await writeFile(filePath, buffer);

        files.push({ url: currentUrl, path: filePath, size: buffer.length });

        // Be gentle to the host
        await sleep(250);
      } catch {
        skippedCount++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return {
    ok: true,
    startUrl,
    outDir,
    found: discoveredUrls.length,
    downloaded: files.length,
    skipped: skippedCount,
    files,
  };
}
