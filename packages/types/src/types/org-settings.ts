import { z } from 'zod/v4';
import {
  OrgSettingsByIdSchema,
  OrgSettingsInsertSchema,
  OrgSettingsListQuerySchema,
  OrgSettingsSelectCoercedSchema,
  OrgSettingsSelectSchema,
  OrgSettingsUpdateSchema,
} from '../schemas/index.js';

export type OrgSettings = z.infer<typeof OrgSettingsSelectSchema>;
export type OrgSettingsCoerced = z.infer<typeof OrgSettingsSelectCoercedSchema>;
export type OrgSettingsInsert = z.infer<typeof OrgSettingsInsertSchema>;
export type OrgSettingsUpdate = z.infer<typeof OrgSettingsUpdateSchema>;
export type OrgSettingsById = z.infer<typeof OrgSettingsByIdSchema>;
export type OrgSettingsListQuery = z.infer<typeof OrgSettingsListQuerySchema>;
