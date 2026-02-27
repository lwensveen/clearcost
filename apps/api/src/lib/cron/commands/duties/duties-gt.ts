import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gt',
  dest: 'GT',
  mfnSourceKey: 'duties.gt.official.mfn_excel',
  ftaSourceKey: 'duties.gt.official.fta_excel',
  mfnEnvVar: 'GT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGtMfnOfficial = commands.mfn;
export const dutiesGtFtaOfficial = commands.fta;
export const dutiesGtAllOfficial = commands.all;
