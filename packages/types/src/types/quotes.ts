import z from 'zod/v4';
import { QuoteInputSchema, QuoteResponseSchema } from '../schemas/quotes.js';

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
