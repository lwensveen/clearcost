import type { Command } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { db, tradeNoticesTable } from '@clearcost/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { attachNoticeDoc, markNoticeStatus } from '../../../../modules/notices/registry.js';
import { parse } from 'node-html-parser';

const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  'clearcost-bot/1.0 (+https://clearcost.io; tariff research; contact: support@clearcost.io)';

type NoticeRow = typeof tradeNoticesTable.$inferSelect;

async function fetchBuffer(url: string): Promise<{ ok: boolean; buf?: Buffer; mime?: string }> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow' });
    if (!res.ok) return { ok: false };
    const array = await res.arrayBuffer();
    return {
      ok: true,
      buf: Buffer.from(array),
      mime: res.headers.get('content-type') ?? undefined,
    };
  } catch {
    return { ok: false };
  }
}

function extractPdfLinks(html: string, baseUrl: string): string[] {
  const root = parse(html);
  const links = root.querySelectorAll('a');
  const out: string[] = [];
  for (const a of links) {
    const href = a.getAttribute('href');
    if (!href) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      if (abs.toLowerCase().includes('.pdf')) out.push(abs);
    } catch {
      // ignore bad hrefs
    }
  }
  // de-dup
  return Array.from(new Set(out));
}

export const fetchNoticeDocsCmd: Command = async (argv) => {
  const flags = parseFlags(argv);

  const dest = flags.dest ? String(flags.dest) : undefined; // --dest CN
  const authority = flags.authority ? String(flags.authority) : undefined; // --authority MOF
  const statuses = (flags.status ? String(flags.status) : 'new')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Array<'new' | 'fetched' | 'parsed' | 'ignored' | 'error'>;

  const limit = Math.max(1, Math.min(500, Number(flags.limit ?? 50)));
  const attachNonPdf = Boolean(flags.attachNonPdf); // also open HTML pages and find PDFs
  const concurrency = Math.max(1, Math.min(8, Number(flags.concurrency ?? 3)));

  // Build WHERE
  const conds: any[] = [];
  if (dest) conds.push(eq(tradeNoticesTable.dest, dest));
  if (authority) conds.push(eq(tradeNoticesTable.authority, authority));
  if (statuses.length) conds.push(inArray(tradeNoticesTable.status, statuses));

  // Prefer PDF-looking URLs first
  const pdfFirst = sql`(lower(${tradeNoticesTable.url}) like '%.pdf%' )`;

  const notices = await db
    .select()
    .from(tradeNoticesTable)
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(pdfFirst), desc(tradeNoticesTable.publishedAt), desc(tradeNoticesTable.createdAt))
    .limit(limit);

  let total = 0;
  let okDirect = 0;
  let okLinked = 0;
  let noneFound = 0;
  let failed = 0;

  // simple pool
  let cursor = 0;
  async function worker() {
    while (cursor < notices.length) {
      const idx = cursor++;
      const n = notices[idx] as NoticeRow;
      total++;

      const isDirectPdf = n.url.toLowerCase().includes('.pdf');

      try {
        // Case A: direct PDF
        if (isDirectPdf) {
          const r = await fetchBuffer(n.url);
          if (!r.ok || !r.buf) {
            await markNoticeStatus(n.id, 'error', `download failed for ${n.url}`);
            failed++;
            continue;
          }
          await attachNoticeDoc({
            noticeId: n.id,
            url: n.url,
            mime: r.mime,
            bytes: r.buf.length,
            body: r.buf,
          });
          await markNoticeStatus(n.id, 'fetched');
          okDirect++;
          continue;
        }

        // Case B: HTML page → try to find PDF links if allowed
        if (attachNonPdf) {
          const page = await fetch(n.url, {
            headers: { 'user-agent': USER_AGENT },
            redirect: 'follow',
          });

          if (!page.ok) {
            await markNoticeStatus(n.id, 'error', `page fetch failed ${page.status}`);
            failed++;
            continue;
          }
          const html = await page.text();
          const pdfs = extractPdfLinks(html, n.url);

          if (!pdfs.length) {
            await markNoticeStatus(n.id, 'ignored', 'no pdf links found on page');
            noneFound++;
            continue;
          }

          // Attach all PDFs found; mark fetched if at least one attached
          let attachedAny = false;
          for (const pdfUrl of pdfs) {
            const r = await fetchBuffer(pdfUrl);
            if (!r.ok || !r.buf) continue;
            await attachNoticeDoc({
              noticeId: n.id,
              url: pdfUrl,
              mime: r.mime,
              bytes: r.buf.length,
              body: r.buf,
            });
            attachedAny = true;
          }
          if (attachedAny) {
            await markNoticeStatus(n.id, 'fetched');
            okLinked++;
          } else {
            await markNoticeStatus(n.id, 'ignored', 'pdf links failed to download');
            noneFound++;
          }
        } else {
          // Not a pdf link and attachNonPdf=0 → ignore quietly
          await markNoticeStatus(n.id, 'ignored', 'non-pdf link and attachNonPdf=0');
          noneFound++;
        }
      } catch (err: any) {
        await markNoticeStatus(n.id, 'error', err?.message ?? 'unknown error');
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log({
    ok: true,
    total,
    okDirect,
    okLinked,
    noneFound,
    failed,
    filtered: { dest, authority, statuses, limit, attachNonPdf, concurrency },
  });
};
