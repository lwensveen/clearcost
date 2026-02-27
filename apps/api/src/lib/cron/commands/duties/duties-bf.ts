import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bf',
  dest: 'BF',
  mfnSourceKey: 'duties.bf.official.mfn_excel',
  ftaSourceKey: 'duties.bf.official.fta_excel',
  mfnEnvVar: 'BF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBfMfnOfficial = commands.mfn;
export const dutiesBfFtaOfficial = commands.fta;
export const dutiesBfAllOfficial = commands.all;
