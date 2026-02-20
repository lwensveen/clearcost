import { parse } from 'node-html-parser';
import { httpFetch } from '../../../../lib/http.js';
import { resolveJpTariffDutySourceUrls } from './source-urls.js';

export async function getLatestJpTariffBase(): Promise<string> {
  const { tariffIndexUrl } = await resolveJpTariffDutySourceUrls();

  const res = await httpFetch(tariffIndexUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`JP index fetch ${res.status}`);
  const root = parse(await res.text());

  // Pick the first link that looks like /english/tariff/YYYY_MM_DD/index.htm
  const a = root
    .querySelectorAll('a')
    .map((el) => el.getAttribute('href') || '')
    .find((href) => /\/english\/tariff\/\d{4}_\d{1,2}(?:_\d{1,2})?\/index\.htm$/i.test(href));
  if (!a) throw new Error('No edition index found');

  const url = new URL(a, tariffIndexUrl).href;
  // Normalize to the directory base; we’ll append data/e_XX.htm later
  return url.replace(/index\.htm$/i, '');
}

export async function listJpTariffChapterPages(baseHref: string): Promise<string[]> {
  const res = await httpFetch(new URL('index.htm', baseHref), { redirect: 'follow' });
  if (!res.ok) throw new Error(`JP edition index ${res.status}`);
  const root = parse(await res.text());

  // Chapter pages look like data/e_XX.htm
  const pages = root
    .querySelectorAll('a')
    .map((el) => el.getAttribute('href') || '')
    .filter((href) => /data\/e_\d{2}\.htm$/i.test(href))
    .map((href) => new URL(href, baseHref).href);

  if (!pages.length) throw new Error('No chapter pages found');
  return pages;
}
