import { z } from 'zod/v4';
import { ErrorResponseSchema } from '../schemas/index.js';

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
