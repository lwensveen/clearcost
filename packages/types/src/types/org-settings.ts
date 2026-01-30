import { z } from 'zod/v4';
import {
  OrgSettingsByIdSchema,
  OrgSettingsBodySchema,
  OrgSettingsInsertSchema,
  OrgSettingsListQuerySchema,
  OrgSettingsResponseSchema,
  OrgSettingsRotateWebhookResponseSchema,
  OrgSettingsSelectCoercedSchema,
  OrgSettingsSelectSchema,
  OrgSettingsUpdateSchema,
  OrgHeaderSchema,
} from '../schemas/index.js';

export type OrgSettings = z.infer<typeof OrgSettingsSelectSchema>;
export type OrgSettingsCoerced = z.infer<typeof OrgSettingsSelectCoercedSchema>;
export type OrgSettingsInsert = z.infer<typeof OrgSettingsInsertSchema>;
export type OrgSettingsUpdate = z.infer<typeof OrgSettingsUpdateSchema>;
export type OrgSettingsById = z.infer<typeof OrgSettingsByIdSchema>;
export type OrgSettingsListQuery = z.infer<typeof OrgSettingsListQuerySchema>;
export type OrgHeader = z.infer<typeof OrgHeaderSchema>;
export type OrgSettingsBody = z.infer<typeof OrgSettingsBodySchema>;
export type OrgSettingsResponse = z.infer<typeof OrgSettingsResponseSchema>;
export type OrgSettingsRotateWebhookResponse = z.infer<
  typeof OrgSettingsRotateWebhookResponseSchema
>;
