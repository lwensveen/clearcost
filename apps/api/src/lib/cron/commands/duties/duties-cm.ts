import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cm',
  dest: 'CM',
  mfnSourceKey: 'duties.cm.official.mfn_excel',
  ftaSourceKey: 'duties.cm.official.fta_excel',
  mfnEnvVar: 'CM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCmMfnOfficial = commands.mfn;
export const dutiesCmFtaOfficial = commands.fta;
export const dutiesCmAllOfficial = commands.all;
