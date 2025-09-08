import { parse } from 'node-html-parser';
import { attachNoticeDoc, ensureNotice } from './registry.js';
import { NOTICE_TYPE_VALUES } from '@clearcost/db';

type NoticeType = (typeof NOTICE_TYPE_VALUES)[number];

const UA =
  process.env.NOTICES_USER_AGENT ??
  process.env.HTTP_USER_AGENT ??
  'clearcost-bot/1.0 (+https://clearcost.io; tariff research; contact: support@clearcost.io)';

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function sameHost(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.host === ub.host;
  } catch {
    return false;
  }
}

function normalizeTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function parseDateLoose(text: string): Date | null {
  // Supports: 2025-04-15, 2025/04/15, 2025.04.15, 2025年04月15日, 2025年4月
  const t = text.replace(/\s+/g, ' ');

  let m = t.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return new Date(y, mo - 1, d);
  }

  m = t.match(/(\d{4})[-/.年](\d{1,2})(?:月)?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (y > 1900 && mo >= 1 && mo <= 12) return new Date(y, mo - 1, 1);
  }

  return null;
}

export type CrawlNoticesOptions = {
  dest: string; // e.g., 'CN'
  authority: string; // e.g., 'MOF', 'GACC'
  type?: NoticeType; // default 'general'
  urls: string[]; // list pages
  sameHostOnly?: boolean; // default true
  include?: string[]; // href must contain ANY (case-insensitive)
  exclude?: string[]; // href must NOT contain ANY (case-insensitive)
  linkSelector?: string; // default 'a'
  attach?: boolean; // fetch & attach PDFs
  lang?: string; // default 'zh'
  tags?: string[]; // optional tags to store on notice
};

export async function crawlNotices(options: CrawlNoticesOptions) {
  const sameHostOnly = options.sameHostOnly ?? true;
  const linkSelector = options.linkSelector ?? 'a';
  const include = (options.include ?? []).map((x) => x.toLowerCase());
  const exclude = (options.exclude ?? []).map((x) => x.toLowerCase());

  const dest = options.dest.toUpperCase();
  const authority = options.authority.trim().toUpperCase();
  const type: NoticeType = options.type ?? 'general';
  const lang = options.lang ?? 'zh';
  const tags = options.tags;

  const found: Array<{ title: string; url: string; context: string; publishedAt: Date | null }> =
    [];
  const seen = new Set<string>();

  for (const listUrl of options.urls) {
    let html = '';
    try {
      const res = await fetch(listUrl, { headers: { 'user-agent': UA }, redirect: 'follow' });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }

    const root = parse(html);
    const anchors = root.querySelectorAll(linkSelector);

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') ?? '';
      if (!href) continue;
      if (/^(javascript:|#)/i.test(href)) continue; // skip non-links

      const abs = absolutize(href, listUrl);
      if (sameHostOnly && !sameHost(listUrl, abs)) continue;

      const hrefLower = abs.toLowerCase();
      if (include.length && !include.some((s) => hrefLower.includes(s))) continue;
      if (exclude.length && exclude.some((s) => hrefLower.includes(s))) continue;

      // Prefer anchor text; fallback to title attribute; fallback to last path segment
      let fallbackName = '';
      try {
        const last = new URL(abs).pathname.split('/').pop() ?? '';
        fallbackName = decodeURIComponent(last);
      } catch {
        /* ignore */
      }

      const title =
        normalizeTitle(anchor.innerText || anchor.getAttribute('title') || fallbackName) ||
        'Untitled';

      // Try to get a date near the anchor: same node or parent
      const context = normalizeTitle(
        (anchor.parentNode?.innerText ?? anchor.innerText ?? '').slice(0, 300)
      );
      const publishedAt = parseDateLoose(`${anchor.innerText} ${context}`);

      const dedupeKey = `${dest}::${authority}::${abs}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      found.push({ title, url: abs, context, publishedAt });
    }
  }

  let persisted = 0;
  let attached = 0;

  for (const item of found) {
    const notice = await ensureNotice({
      dest,
      authority,
      type,
      lang,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      summary: item.context,
      tags,
    });

    if (notice) persisted++;

    if (options.attach && /\.pdf($|\?)/i.test(item.url)) {
      try {
        const res = await fetch(item.url, { headers: { 'user-agent': UA }, redirect: 'follow' });
        if (!res.ok) continue;

        const buf = Buffer.from(await res.arrayBuffer());
        await attachNoticeDoc({
          noticeId: notice.id,
          url: item.url,
          mime: res.headers.get('content-type') ?? undefined,
          bytes: buf.length,
          body: buf,
        });
        attached++;
      } catch {
        /* ignore attachment failures */
      }
    }
  }

  return {
    ok: true as const,
    scannedPages: options.urls.length,
    candidates: found.length,
    persisted,
    attached,
  };
}
