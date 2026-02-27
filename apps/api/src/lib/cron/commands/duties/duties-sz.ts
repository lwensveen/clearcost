import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sz',
  dest: 'SZ',
  mfnSourceKey: 'duties.sz.official.mfn_excel',
  ftaSourceKey: 'duties.sz.official.fta_excel',
  mfnEnvVar: 'SZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSzMfnOfficial = commands.mfn;
export const dutiesSzFtaOfficial = commands.fta;
export const dutiesSzAllOfficial = commands.all;
