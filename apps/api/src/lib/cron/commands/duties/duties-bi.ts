import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bi',
  dest: 'BI',
  mfnSourceKey: 'duties.bi.official.mfn_excel',
  ftaSourceKey: 'duties.bi.official.fta_excel',
  mfnEnvVar: 'BI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBiMfnOfficial = commands.mfn;
export const dutiesBiFtaOfficial = commands.fta;
export const dutiesBiAllOfficial = commands.all;
