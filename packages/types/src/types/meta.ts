import { z } from 'zod/v4';
import {
  MetaCapabilitiesResponseSchema,
  MetaHealthResponseSchema,
  MetaVersionResponseSchema,
} from '../schemas/index.js';

export type MetaHealthResponse = z.infer<typeof MetaHealthResponseSchema>;
export type MetaVersionResponse = z.infer<typeof MetaVersionResponseSchema>;
export type MetaCapabilitiesResponse = z.infer<typeof MetaCapabilitiesResponseSchema>;
