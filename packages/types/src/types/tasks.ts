import { z } from 'zod/v4';
import {
  TasksDeMinimisImportBodySchema,
  TasksDutyCnMfnPdfBodySchema,
  TasksDutyEuDailyBodySchema,
  TasksDutyHs6BatchBodySchema,
  TasksDutyHs6BatchDryRunBodySchema,
  TasksDutyHs6BatchPartnerGeoIdsBodySchema,
  TasksDutyHs6BatchPartnersBodySchema,
  TasksDutyJsonImportResponseSchema,
  TasksDutyIdBodySchema,
  TasksDutyIdFtaBodySchema,
  TasksDutyIdBtkiCrawlBodySchema,
  TasksDutyMyFtaOfficialExcelBodySchema,
  TasksDutyMyOfficialExcelBodySchema,
  TasksDutyMyOfficialPdfBodySchema,
  TasksDutyPhBodySchema,
  TasksDutyWitsAseanBodySchema,
  TasksDutyWitsGenericBodySchema,
  TasksDutyWitsJapanBodySchema,
  TasksHsAhtnBodySchema,
  TasksNoticesCrawlBodySchema,
  TasksPruneImportsBodySchema,
  TasksSurchargeEuBodySchema,
  TasksSurchargeGenericJsonBodySchema,
  TasksSurchargeUkBodySchema,
  TasksSurchargeUsAllBodySchema,
  TasksSurchargeUsTradeRemediesBodySchema,
  TasksSweepStaleBodySchema,
} from '../schemas/tasks.js';

export type TasksPruneImportsBody = z.infer<typeof TasksPruneImportsBodySchema>;
export type TasksSweepStaleBody = z.infer<typeof TasksSweepStaleBodySchema>;
export type TasksDeMinimisImportBody = z.infer<typeof TasksDeMinimisImportBodySchema>;
export type TasksNoticesCrawlBody = z.infer<typeof TasksNoticesCrawlBodySchema>;
export type TasksDutyHs6BatchBody = z.infer<typeof TasksDutyHs6BatchBodySchema>;
export type TasksDutyHs6BatchDryRunBody = z.infer<typeof TasksDutyHs6BatchDryRunBodySchema>;
export type TasksDutyHs6BatchPartnersBody = z.infer<typeof TasksDutyHs6BatchPartnersBodySchema>;
export type TasksDutyHs6BatchPartnerGeoIdsBody = z.infer<
  typeof TasksDutyHs6BatchPartnerGeoIdsBodySchema
>;
export type TasksDutyCnMfnPdfBody = z.infer<typeof TasksDutyCnMfnPdfBodySchema>;
export type TasksDutyEuDailyBody = z.infer<typeof TasksDutyEuDailyBodySchema>;
export type TasksDutyJsonImportResponse = z.infer<typeof TasksDutyJsonImportResponseSchema>;
export type TasksDutyMyOfficialExcelBody = z.infer<typeof TasksDutyMyOfficialExcelBodySchema>;
export type TasksDutyMyOfficialPdfBody = z.infer<typeof TasksDutyMyOfficialPdfBodySchema>;
export type TasksDutyMyFtaOfficialExcelBody = z.infer<typeof TasksDutyMyFtaOfficialExcelBodySchema>;
export type TasksDutyIdBody = z.infer<typeof TasksDutyIdBodySchema>;
export type TasksDutyIdFtaBody = z.infer<typeof TasksDutyIdFtaBodySchema>;
export type TasksDutyIdBtkiCrawlBody = z.infer<typeof TasksDutyIdBtkiCrawlBodySchema>;
export type TasksDutyPhBody = z.infer<typeof TasksDutyPhBodySchema>;
export type TasksDutyWitsGenericBody = z.infer<typeof TasksDutyWitsGenericBodySchema>;
export type TasksDutyWitsAseanBody = z.infer<typeof TasksDutyWitsAseanBodySchema>;
export type TasksDutyWitsJapanBody = z.infer<typeof TasksDutyWitsJapanBodySchema>;
export type TasksHsAhtnBody = z.infer<typeof TasksHsAhtnBodySchema>;
export type TasksSurchargeEuBody = z.infer<typeof TasksSurchargeEuBodySchema>;
export type TasksSurchargeUkBody = z.infer<typeof TasksSurchargeUkBodySchema>;
export type TasksSurchargeUsTradeRemediesBody = z.infer<
  typeof TasksSurchargeUsTradeRemediesBodySchema
>;
export type TasksSurchargeUsAllBody = z.infer<typeof TasksSurchargeUsAllBodySchema>;
export type TasksSurchargeGenericJsonBody = z.infer<typeof TasksSurchargeGenericJsonBodySchema>;
