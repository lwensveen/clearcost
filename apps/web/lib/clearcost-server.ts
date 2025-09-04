'use server';

import type { ClassifyInput, ClassifyResponse, QuoteInput, QuoteResponse } from '@clearcost/sdk';
import { classify, createQuote, getQuoteByKey } from '@clearcost/sdk';

function sdk() {
  const baseUrl = process.env.CLEARCOST_API_URL!;
  const apiKey = process.env.CLEARCOST_WEB_SERVER_KEY!;
  if (!baseUrl || !apiKey) throw new Error('Missing CLEARCOST_API_URL / CLEARCOST_WEB_SERVER_KEY');
  return { baseUrl, apiKey };
}

export async function createQuoteServer(
  body: QuoteInput,
  idemKey?: string
): Promise<{ quote: QuoteResponse; idempotencyKey: string }> {
  const { quote, idempotencyKey } = await createQuote(sdk(), body, { idempotencyKey: idemKey });
  return { quote, idempotencyKey };
}

export async function getQuoteByKeyServer(key: string): Promise<QuoteResponse> {
  return getQuoteByKey(sdk(), key);
}

export async function classifyServer(payload: ClassifyInput): Promise<ClassifyResponse> {
  const { result } = await classify(sdk(), payload);
  return result;
}
