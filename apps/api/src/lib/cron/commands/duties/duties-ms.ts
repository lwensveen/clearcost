import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ms',
  dest: 'MS',
  mfnSourceKey: 'duties.ms.official.mfn_excel',
  ftaSourceKey: 'duties.ms.official.fta_excel',
  mfnEnvVar: 'MS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMsMfnOfficial = commands.mfn;
export const dutiesMsFtaOfficial = commands.fta;
export const dutiesMsAllOfficial = commands.all;
