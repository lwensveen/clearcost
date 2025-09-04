import { z } from 'zod/v4';
import {
  DimsCmInputSchema,
  ListManifestsResultSchema,
  ManifestCreateInputSchema,
  ManifestDetailSchema,
  ManifestItemInputSchema,
  ManifestModeSchema,
  ManifestSummarySchema,
  MoneyInputSchema,
} from '../schemas/index.js';

export type ManifestMode = z.infer<typeof ManifestModeSchema>;
export type MoneyInput = z.infer<typeof MoneyInputSchema>;
export type DimsCmInput = z.infer<typeof DimsCmInputSchema>;
export type ManifestItemInput = z.infer<typeof ManifestItemInputSchema>;
export type ManifestCreateInput = z.infer<typeof ManifestCreateInputSchema>;
export type ManifestSummary = z.infer<typeof ManifestSummarySchema>;
export type ManifestDetail = z.infer<typeof ManifestDetailSchema>;
export type ListManifestsResult = z.infer<typeof ListManifestsResultSchema>;
