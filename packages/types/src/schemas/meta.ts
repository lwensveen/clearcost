import { z } from 'zod/v4';

export const MetaHealthResponseSchema = z.object({ ok: z.literal(true) });

export const MetaVersionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  gitSha: z.string().optional(),
  buildTime: z.string().optional(),
});

export const MetaDatasetCapabilitySchema = z.object({
  supportedRegions: z.array(z.string()),
  scheduled: z.boolean(),
  freshnessThresholdHours: z.number().int().positive().nullable(),
});

export const MetaCapabilitiesResponseSchema = z.object({
  apiVersion: z.string(),
  buildSha: z.string().nullable().optional(),
  datasets: z.object({
    duties: MetaDatasetCapabilitySchema,
    vat: MetaDatasetCapabilitySchema,
    'de-minimis': MetaDatasetCapabilitySchema,
    surcharges: MetaDatasetCapabilitySchema,
    'hs-aliases': MetaDatasetCapabilitySchema,
    freight: MetaDatasetCapabilitySchema,
    fx: MetaDatasetCapabilitySchema,
    notices: MetaDatasetCapabilitySchema,
  }),
});
