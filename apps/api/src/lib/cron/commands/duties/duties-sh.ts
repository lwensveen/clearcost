import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sh',
  dest: 'SH',
  mfnSourceKey: 'duties.sh.official.mfn_excel',
  ftaSourceKey: 'duties.sh.official.fta_excel',
  mfnEnvVar: 'SH_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SH_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesShMfnOfficial = commands.mfn;
export const dutiesShFtaOfficial = commands.fta;
export const dutiesShAllOfficial = commands.all;
