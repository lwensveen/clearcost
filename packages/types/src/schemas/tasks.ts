import { z } from 'zod/v4';
import { NOTICE_TYPE_VALUES } from '@clearcost/db';

// Shared duty import pieces
const Hs6ListSchema = z.array(z.string().regex(/^\d{6}$/)).optional();
const BatchSizeSchema = z.coerce.number().int().min(1).max(20_000).optional();

export const TasksPruneImportsBodySchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(90),
});

export const TasksSweepStaleBodySchema = z.object({
  thresholdMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional(),
  limit: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const TasksDeMinimisImportBodySchema = z.object({
  effectiveOn: z.coerce.date().optional(),
});

export const TasksNoticesCrawlBodySchema = z.object({
  urls: z.array(z.string().url()).optional(),
  includeHints: z.array(z.string()).optional(),
  excludeHints: z.array(z.string()).optional(),
  maxDepth: z.coerce.number().int().min(0).max(4).default(1),
  concurrency: z.coerce.number().int().min(1).max(10).default(4),
  outDir: z.string().optional(),
  dest: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .default('CN'),
  type: z.enum(NOTICE_TYPE_VALUES).default('general'),
  lang: z.string().min(2).max(8).default('zh'),
  tags: z.array(z.string()).optional(),
});

export const TasksHsAhtnBodySchema = z.object({
  url: z.string().url().optional(),
  batchSize: z.coerce.number().int().min(1).max(20000).optional(),
});

export const TasksDutyHs6BatchBodySchema = z.object({
  hs6: Hs6ListSchema,
  batchSize: BatchSizeSchema,
});

export const TasksDutyHs6BatchDryRunBodySchema = TasksDutyHs6BatchBodySchema.extend({
  dryRun: z.boolean().optional(),
});

export const TasksDutyHs6BatchPartnersBodySchema = TasksDutyHs6BatchBodySchema.extend({
  partners: z.array(z.string()).optional(),
});

export const TasksDutyHs6BatchPartnerGeoIdsBodySchema = TasksDutyHs6BatchDryRunBodySchema.extend({
  partnerGeoIds: z.array(z.string()).optional(),
});

export const TasksDutyCnMfnPdfBodySchema = z.object({
  url: z.string().url(),
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyEuDailyBodySchema = z.object({
  date: z
    .string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/)
    .optional(),
  include: z.enum(['mfn', 'fta', 'both']).optional().default('both'),
  partnerGeoIds: z.array(z.string()).optional(),
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyMyOfficialExcelBodySchema = z.object({
  url: z.string().url().optional(),
  sheet: z.union([z.string(), z.coerce.number()]).optional(),
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyMyOfficialPdfBodySchema = z.object({
  url: z.string().url().optional(),
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyMyFtaOfficialExcelBodySchema = z.object({
  url: z.string().url().optional(),
  agreement: z.string().optional(),
  partner: z.string().optional(),
  sheet: z.union([z.string(), z.coerce.number()]).optional(),
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyIdBodySchema = z.object({
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyIdFtaBodySchema = TasksDutyIdBodySchema.extend({
  partnerGeoIds: z.array(z.string()).optional(),
});

export const TasksDutyIdBtkiCrawlBodySchema = z.object({
  startUrl: z.string().url().optional(),
  maxDepth: z.coerce.number().int().min(0).max(5).optional(),
  concurrency: z.coerce.number().int().min(1).max(8).optional(),
  outDir: z.string().optional(),
  includeHints: z.array(z.string()).optional(),
  excludeHints: z.array(z.string()).optional(),
});

export const TasksDutyPhBodySchema = z.object({
  url: z.string().min(1).optional(),
  sheet: z.union([z.string(), z.coerce.number()]).optional(),
  mapFreeToZero: z.boolean().optional(),
  skipSpecific: z.boolean().optional(),
  batchSize: BatchSizeSchema,
  dryRun: z.boolean().optional(),
});

export const TasksDutyWitsGenericBodySchema = z.object({
  dests: z.array(z.string().length(2)).min(1),
  partners: z.array(z.string().length(2)).optional().default([]),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  backfillYears: z.coerce.number().int().min(0).max(5).default(1),
  concurrency: z.coerce.number().int().min(1).max(6).default(3),
  batchSize: z.coerce.number().int().min(1).max(20_000).default(5000),
  hs6List: z.array(z.string().regex(/^\d{6}$/)).optional(),
});

export const TasksDutyWitsAseanBodySchema = z.object({
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  backfillYears: z.coerce.number().int().min(0).max(5).default(1),
  concurrency: z.coerce.number().int().min(1).max(6).default(4),
  hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
  dests: z.array(z.string().length(2)).optional(),
  partners: z.array(z.string().length(2)).optional(),
});

export const TasksDutyWitsJapanBodySchema = z.object({
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  backfillYears: z.coerce.number().int().min(0).max(5).default(1),
  concurrency: z.coerce.number().int().min(1).max(6).default(3),
  hs6: z.array(z.string().regex(/^\d{6}$/)).optional(),
  partners: z.array(z.string().length(2)).optional(),
});

export const TasksSurchargeEuBodySchema = z.object({
  measureTypeIds: z.array(z.string().min(1)).optional(),
});

export const TasksSurchargeUkBodySchema = z.object({
  measureTypeIds: z.array(z.string().min(1)).optional(),
  batchSize: BatchSizeSchema,
});

export const TasksSurchargeUsTradeRemediesBodySchema = z.object({
  effectiveFrom: z.coerce.date().optional(),
  skipFree: z.coerce.boolean().default(false),
  batchSize: BatchSizeSchema,
});

export const TasksSurchargeUsAllBodySchema = z.object({
  batchSize: BatchSizeSchema,
});

export const TasksSurchargeGenericJsonBodySchema = z.object({
  path: z.string().min(1).optional(),
});

export const TasksDutyJsonImportResponseSchema = z.object({
  ok: z.literal(true),
  count: z.number().int().nonnegative(),
});
