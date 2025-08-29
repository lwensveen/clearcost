import setCookie from 'set-cookie-parser';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36';

type CookieJarEntry = { name: string; value: string; domain: string; path: string };

export class UsitcClient {
  // Scope cookies by domain+path like a browser
  private jar: CookieJarEntry[] = [];
  constructor(private base = 'https://hts.usitc.gov') {}

  // Hit both domains and the export page; read bodies to completion
  async warm() {
    const pages = [
      'https://www.usitc.gov/harmonized_tariff_information',
      `${this.base}/`,
      `${this.base}/export`,
    ];
    for (const url of pages) {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      });
      this.storeCookies(res, url);
      await res.arrayBuffer().catch(() => null);
    }
  }

  async getText(pathOrUrl: string, accept = 'application/json,text/plain,*/*'): Promise<string> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.base}${pathOrUrl}`;
    const referer = this.refererFor(url);
    const origin = referer?.replace(/\/$/, '');
    const cookie = this.cookieHeader(url);
    const site = this.siteFor(url);

    // 3 header modes (least suspicious first)
    const headerModes: Record<string, string>[] = [
      {
        'User-Agent': UA,
        Accept: accept,
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        ...(site ? { 'Sec-Fetch-Site': site } : {}),
        ...(referer ? { Referer: referer } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      {
        'User-Agent': UA,
        Accept: accept,
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        ...(site ? { 'Sec-Fetch-Site': site } : {}),
        ...(referer ? { Referer: referer } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      {
        'User-Agent': UA,
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        ...(site ? { 'Sec-Fetch-Site': site } : {}),
        ...(referer ? { Referer: referer } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    ];

    // Try each header mode; if we see HTML, re-warm once and retry the same mode
    let warmed = false;
    for (const hdrs of headerModes) {
      try {
        let body = await this.fetchTextOnce(url, hdrs);
        if (this.isHtml(body)) {
          if (!warmed) {
            await this.warm();
            warmed = true;
            body = await this.fetchTextOnce(url, hdrs);
          }
          if (this.isHtml(body)) {
            // still SPA shell; try next header mode
            continue;
          }
        }
        return body;
      } catch {
        // try next mode
      }
    }
    // last attempt with re-warm
    await this.warm();
    return this.fetchTextOnce(url, headerModes[headerModes.length - 1]!);
  }

  async getJson(pathOrUrl: string): Promise<any> {
    const text = await this.getText(pathOrUrl, 'application/json,text/plain,*/*');
    const trimmed = text.trim();
    // strict parse
    try {
      if (!trimmed) throw new Error('Empty body');
      return JSON.parse(trimmed);
    } catch {
      // salvage JSON substring if the server wrapped it
      const start = text.search(/[\[{]/);
      const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
      if (start >= 0 && end > start) {
        const sub = text.slice(start, end + 1);
        try {
          return JSON.parse(sub);
        } catch {
          /* empty */
        }
      }
      const preview = text.slice(0, 200).replace(/\s+/g, ' ');
      throw new Error(`Failed to parse JSON: ${preview}`);
    }
  }

  // ---- cookie utils ----
  private cookieHeader(targetUrl: string) {
    if (this.jar.length === 0) return '';
    const { host, pathname } = new URL(targetUrl);
    const matches = this.jar.filter((c) => {
      const d = c.domain.replace(/^\./, '');
      const domainOk = host === d || host.endsWith('.' + d);
      const pathOk = pathname.startsWith(c.path || '/');
      return domainOk && pathOk;
    });
    return matches.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  private storeCookies(res: Response, reqUrl?: string) {
    const raw = res.headers.get('set-cookie');
    if (!raw) return;
    let fallbackHost = '';
    try {
      if (reqUrl) fallbackHost = new URL(reqUrl).hostname;
    } catch {
      /* empty */
    }
    for (const c of setCookie.parse(raw, { map: false })) {
      // set-cookie-parser types are loose; guard in case fields are missing
      const domain = (c.domain as string | undefined)?.toLowerCase() || fallbackHost || '';
      const path = (c.path as string | undefined) || '/';
      if (!c.name || !c.value || !domain) continue;
      // replace existing cookie with same (name,domain,path)
      this.jar = this.jar.filter(
        (x) => !(x.name === c.name && x.domain === domain && x.path === path)
      );
      this.jar.push({ name: c.name, value: c.value, domain, path });
    }
  }

  private isHtml(body: string) {
    return /^\s*<(?:!doctype|html|head|body)\b/i.test(body);
  }

  private cacheBust(url: string) {
    try {
      const u = new URL(url);
      u.searchParams.set('_', String(Date.now()));
      return u.toString();
    } catch {
      return url;
    }
  }

  private refererFor(url: string) {
    try {
      const u = new URL(url);
      if (u.hostname === 'www.usitc.gov')
        return 'https://www.usitc.gov/harmonized_tariff_information';
      if (u.hostname.endsWith('usitc.gov'))
        return 'https://www.usitc.gov/harmonized_tariff_information';
      if (u.hostname.endsWith('hts.usitc.gov')) return `${this.base}/export`;
    } catch {
      /* empty */
    }
    return undefined;
  }

  private siteFor(url: string): 'same-origin' | 'same-site' | 'cross-site' | undefined {
    try {
      const target = new URL(url);
      const base = new URL(this.base);
      if (target.origin === base.origin) return 'same-origin';
      if (target.hostname.endsWith('.usitc.gov') && base.hostname.endsWith('.usitc.gov'))
        return 'same-site';
      return 'cross-site';
    } catch {
      return undefined;
    }
  }

  // Text fetch with retry if we get HTML app shell
  private async fetchTextOnce(url0: string, headers: Record<string, string>): Promise<string> {
    const url = this.cacheBust(url0);
    const res = await fetch(url, { headers, redirect: 'follow' });
    this.storeCookies(res, url0);
    const raw = (await res.text()).replace(/^\uFEFF/, '');
    if (!res.ok) {
      const preview = raw.slice(0, 200).replace(/\s+/g, ' ');
      throw new Error(`HTTP ${res.status} for ${url} :: ${preview}`);
    }
    return raw;
  }
}
