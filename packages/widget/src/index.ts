type QuoteBody = {
  origin: string;
  dest: string;
  itemValue: { amount: number; currency: string };
  dimsCm: { l: number; w: number; h: number };
  weightKg: number;
  categoryKey: string;
  hs6?: string;
  mode: 'air' | 'sea';
};

type SDK = {
  baseUrl?: string; // e.g. https://api.clearcost.dev
  apiKey?: string; // only if calling API directly (not recommended for browser)
  proxyUrl?: string; // e.g. /api/clearcost/quote (recommended)
};

type Opts = SDK & {
  auto?: boolean; // auto calculate on init
  locale?: string; // e.g. 'en-US'
  currency?: string; // display currency override
};

function formatMoney(x: number, currency: string, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(x);
  } catch {
    return `${currency} ${x.toFixed(2)}`;
  }
}

async function genIdemKey(): Promise<string> {
  const g: any = globalThis as any;
  if (!g.crypto) throw new Error('Web Crypto not available');

  if (typeof g.crypto.randomUUID === 'function') {
    return 'ck_idem_' + g.crypto.randomUUID().replace(/-/g, '');
  }

  const bytes = new Uint8Array(16);
  g.crypto.getRandomValues(bytes);

  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const base64 = btoa(bin);
  const b64url = base64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `ck_idem_${b64url}`;
}

async function callQuote(body: QuoteBody, sdk: SDK): Promise<any> {
  const idem = await genIdemKey();

  if (sdk.proxyUrl) {
    const res = await fetch(sdk.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }

  if (!sdk.baseUrl || !sdk.apiKey) throw new Error('Missing baseUrl/apiKey or proxyUrl');
  const res = await fetch(`${sdk.baseUrl}/v1/quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idem,
      Authorization: `Bearer ${sdk.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function render(el: HTMLElement, quote: any, displayCurrency: string, locale: string) {
  const { components, total, incoterm } = quote;
  const cur = displayCurrency || (quote?.currency ?? 'USD');

  const mk = (tag: string, style?: string, text?: string) => {
    const n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text != null) n.textContent = text;
    return n;
  };
  const money = (x: number) => formatMoney(Number(x) || 0, cur, locale);
  const row = (label: string, amount: number) => {
    const d = mk('div', 'display:flex; justify-content:space-between;');
    d.appendChild(mk('span', undefined, label));
    d.appendChild(mk('span', undefined, money(amount)));
    return d;
  };

  const freight = Number(components.CIF || 0) - Number(quote.itemValue || 0);

  const wrap = mk(
    'div',
    'font-family: ui-sans-serif, system-ui; border:1px solid #e5e7eb; border-radius:12px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,.06)'
  );

  const header = mk('div', 'display:flex; justify-content:space-between; margin-bottom:8px;');
  header.appendChild(mk('strong', undefined, 'Landed cost'));
  header.appendChild(mk('span', 'font-weight:600', money(total)));
  wrap.appendChild(header);

  const list = mk('div', 'font-size:12px; color:#374151; line-height:1.4');
  list.appendChild(row('Freight', freight));
  list.appendChild(row('Duty', Number(components.duty || 0)));
  list.appendChild(row('VAT', Number(components.vat || 0)));
  if (components.checkoutVAT !== undefined) {
    list.appendChild(row('Checkout VAT (IOSS)', Number(components.checkoutVAT || 0)));
  }
  list.appendChild(row('Fees', Number(components.fees || 0)));

  const inc = mk('div', 'margin-top:6px; color:#6b7280', 'Incoterm: ');
  const strong = mk('strong', undefined, (incoterm ?? 'DAP') + '');
  inc.appendChild(strong);
  list.appendChild(inc);

  wrap.appendChild(list);

  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(wrap);
}

function parseEl(el: HTMLElement): QuoteBody {
  const g = (k: string) => el.getAttribute(k) ?? '';
  return {
    origin: g('data-origin'),
    dest: g('data-dest'),
    itemValue: { amount: Number(g('data-price')), currency: g('data-currency') || 'USD' },
    dimsCm: { l: Number(g('data-l')), w: Number(g('data-w')), h: Number(g('data-h')) },
    weightKg: Number(g('data-weight')),
    categoryKey: g('data-category-key') || 'general',
    hs6: g('data-hs6') || undefined,
    mode: (g('data-mode') as 'air' | 'sea') || 'air',
  };
}

async function bootOne(el: HTMLElement, opts: Opts) {
  const body = parseEl(el);
  const currency = (opts.currency ?? body.itemValue.currency).toUpperCase();
  const locale = opts.locale ?? 'en-US';

  const button = document.createElement('button');
  button.textContent = 'Estimate duties & taxes';
  button.style.cssText =
    'padding:8px 12px;border-radius:8px;border:1px solid #e5e7eb;background:white;cursor:pointer;';
  el.appendChild(button);

  const box = document.createElement('div');
  box.style.marginTop = '8px';
  el.appendChild(box);

  async function run() {
    button.disabled = true;
    button.textContent = 'Calculating…';
    try {
      const q = await callQuote(body, opts);
      (q as any).itemValue = body.itemValue.amount;
      render(box, q, currency, locale);
      button.textContent = 'Recalculate';
    } catch (e: any) {
      box.textContent = `Failed: ${e?.message ?? e}`;
      button.textContent = 'Retry';
    } finally {
      button.disabled = false;
    }
  }

  button.onclick = run;
  if (opts.auto) await run();
}

export function mountAll(opts: Opts) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-clearcost]'));
  nodes.forEach((el) => void bootOne(el, opts));
}
