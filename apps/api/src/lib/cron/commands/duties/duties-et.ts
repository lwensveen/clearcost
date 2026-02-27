import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'et',
  dest: 'ET',
  mfnSourceKey: 'duties.et.official.mfn_excel',
  ftaSourceKey: 'duties.et.official.fta_excel',
  mfnEnvVar: 'ET_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ET_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesEtMfnOfficial = commands.mfn;
export const dutiesEtFtaOfficial = commands.fta;
export const dutiesEtAllOfficial = commands.all;
