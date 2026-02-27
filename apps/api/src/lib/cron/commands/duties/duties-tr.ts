import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tr',
  dest: 'TR',
  mfnSourceKey: 'duties.tr.official.mfn_excel',
  ftaSourceKey: 'duties.tr.official.fta_excel',
  mfnEnvVar: 'TR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTrMfnOfficial = commands.mfn;
export const dutiesTrFtaOfficial = commands.fta;
export const dutiesTrAllOfficial = commands.all;
