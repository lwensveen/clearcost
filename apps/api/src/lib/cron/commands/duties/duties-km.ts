import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'km',
  dest: 'KM',
  mfnSourceKey: 'duties.km.official.mfn_excel',
  ftaSourceKey: 'duties.km.official.fta_excel',
  mfnEnvVar: 'KM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKmMfnOfficial = commands.mfn;
export const dutiesKmFtaOfficial = commands.fta;
export const dutiesKmAllOfficial = commands.all;
