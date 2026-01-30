import { z } from 'zod/v4';
import { MetaHealthResponseSchema, MetaVersionResponseSchema } from '../schemas/index.js';

export type MetaHealthResponse = z.infer<typeof MetaHealthResponseSchema>;
export type MetaVersionResponse = z.infer<typeof MetaVersionResponseSchema>;
