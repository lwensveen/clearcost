import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'no',
  dest: 'NO',
  mfnSourceKey: 'duties.no.official.mfn_excel',
  ftaSourceKey: 'duties.no.official.fta_excel',
  mfnEnvVar: 'NO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNoMfnOfficial = commands.mfn;
export const dutiesNoFtaOfficial = commands.fta;
export const dutiesNoAllOfficial = commands.all;
