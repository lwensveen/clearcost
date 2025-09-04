import { z } from 'zod/v4';
import { ClassifyInputSchema, ClassifyResponseSchema } from '../schemas/classify.js';

export type ClassifyInput = z.infer<typeof ClassifyInputSchema>;
export type ClassifyResponse = z.infer<typeof ClassifyResponseSchema>;
