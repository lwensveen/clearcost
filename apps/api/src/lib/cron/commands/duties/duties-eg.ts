import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'eg',
  dest: 'EG',
  mfnSourceKey: 'duties.eg.official.mfn_excel',
  ftaSourceKey: 'duties.eg.official.fta_excel',
  mfnEnvVar: 'EG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'EG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesEgMfnOfficial = commands.mfn;
export const dutiesEgFtaOfficial = commands.fta;
export const dutiesEgAllOfficial = commands.all;
