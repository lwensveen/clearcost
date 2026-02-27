import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ai',
  dest: 'AI',
  mfnSourceKey: 'duties.ai.official.mfn_excel',
  ftaSourceKey: 'duties.ai.official.fta_excel',
  mfnEnvVar: 'AI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAiMfnOfficial = commands.mfn;
export const dutiesAiFtaOfficial = commands.fta;
export const dutiesAiAllOfficial = commands.all;
