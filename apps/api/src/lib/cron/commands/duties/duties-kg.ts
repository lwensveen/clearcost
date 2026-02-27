import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'kg',
  dest: 'KG',
  mfnSourceKey: 'duties.kg.official.mfn_excel',
  ftaSourceKey: 'duties.kg.official.fta_excel',
  mfnEnvVar: 'KG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKgMfnOfficial = commands.mfn;
export const dutiesKgFtaOfficial = commands.fta;
export const dutiesKgAllOfficial = commands.all;
