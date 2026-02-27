import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sv',
  dest: 'SV',
  mfnSourceKey: 'duties.sv.official.mfn_excel',
  ftaSourceKey: 'duties.sv.official.fta_excel',
  mfnEnvVar: 'SV_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SV_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSvMfnOfficial = commands.mfn;
export const dutiesSvFtaOfficial = commands.fta;
export const dutiesSvAllOfficial = commands.all;
