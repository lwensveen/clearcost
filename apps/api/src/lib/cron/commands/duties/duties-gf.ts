import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gf',
  dest: 'GF',
  mfnSourceKey: 'duties.gf.official.mfn_excel',
  ftaSourceKey: 'duties.gf.official.fta_excel',
  mfnEnvVar: 'GF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGfMfnOfficial = commands.mfn;
export const dutiesGfFtaOfficial = commands.fta;
export const dutiesGfAllOfficial = commands.all;
