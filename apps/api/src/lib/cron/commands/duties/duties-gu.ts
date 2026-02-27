import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gu',
  dest: 'GU',
  mfnSourceKey: 'duties.gu.official.mfn_excel',
  ftaSourceKey: 'duties.gu.official.fta_excel',
  mfnEnvVar: 'GU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGuMfnOfficial = commands.mfn;
export const dutiesGuFtaOfficial = commands.fta;
export const dutiesGuAllOfficial = commands.all;
