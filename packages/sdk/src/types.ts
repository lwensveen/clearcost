export type SDKOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
};

export type IdemOptions = { idempotencyKey?: string };

export type QuoteInput = {
  origin: string;
  dest: string;
  itemValue: { amount: number; currency: string };
  dimsCm: { l: number; w: number; h: number };
  weightKg: number;
  categoryKey: string;
  userHs6?: string;
  mode: 'air' | 'sea';
};

export type QuoteResponse = {
  hs6: string;
  chargeableKg: number;
  freight: number;
  components: { CIF: number; duty: number; vat: number; fees: number; checkoutVAT?: number };
  total: number;
  guaranteedMax: number;
  policy: string;
  incoterm: 'DAP' | 'DDP';
};

export type ClassifyInput = {
  title: string;
  description?: string;
  categoryKey?: string;
  origin?: string;
};
export type ClassifyResponse = {
  hs6: string;
  confidence: number;
  candidates?: Array<{ hs6: string; title: string; score: number }>;
};
