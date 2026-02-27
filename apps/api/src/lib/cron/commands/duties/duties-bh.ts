import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bh',
  dest: 'BH',
  mfnSourceKey: 'duties.bh.official.mfn_excel',
  ftaSourceKey: 'duties.bh.official.fta_excel',
  mfnEnvVar: 'BH_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BH_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBhMfnOfficial = commands.mfn;
export const dutiesBhFtaOfficial = commands.fta;
export const dutiesBhAllOfficial = commands.all;
