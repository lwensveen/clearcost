import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'st',
  dest: 'ST',
  mfnSourceKey: 'duties.st.official.mfn_excel',
  ftaSourceKey: 'duties.st.official.fta_excel',
  mfnEnvVar: 'ST_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ST_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesStMfnOfficial = commands.mfn;
export const dutiesStFtaOfficial = commands.fta;
export const dutiesStAllOfficial = commands.all;
