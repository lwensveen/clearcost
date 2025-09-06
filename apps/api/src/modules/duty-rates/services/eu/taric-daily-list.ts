import { parse } from 'node-html-parser';

const LIST_URL =
  process.env.EU_TARIC_DAILY_LIST ??
  'https://ec.europa.eu/taxation_customs/dds2/taric/daily_publications.jsp?Lang=en';

export async function getLatestDailyZipUrl(listUrl = LIST_URL): Promise<string> {
  const res = await fetch(listUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`list fetch ${res.status}`);
  const root = parse(await res.text());
  const a = root.querySelectorAll('a').find((el) => /download/i.test(el.innerText));
  if (!a) throw new Error('No TARIC daily ZIP link found');
  const href = a.getAttribute('href') || '';
  return new URL(href, listUrl).href;
}

export async function getDailyZipUrlForDate(dateYmd: string, listUrl = LIST_URL): Promise<string> {
  const res = await fetch(listUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`list fetch ${res.status}`);
  const root = parse(await res.text());
  const rows = root.querySelectorAll('tr, .resultRow, .row'); // be liberal in selectors

  const row = rows.find((r) => r.innerText?.includes(dateYmd));
  if (!row) throw new Error(`No daily publication row for ${dateYmd}`);
  const a = row.querySelectorAll('a').find((el) => /download/i.test(el.innerText));
  if (!a) throw new Error(`No download link for ${dateYmd}`);
  const href = a.getAttribute('href') || '';
  return new URL(href, listUrl).href;
}
