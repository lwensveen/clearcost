import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'af',
  dest: 'AF',
  mfnSourceKey: 'duties.af.official.mfn_excel',
  ftaSourceKey: 'duties.af.official.fta_excel',
  mfnEnvVar: 'AF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAfMfnOfficial = commands.mfn;
export const dutiesAfFtaOfficial = commands.fta;
export const dutiesAfAllOfficial = commands.all;
