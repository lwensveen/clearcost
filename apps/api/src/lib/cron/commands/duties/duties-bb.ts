import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bb',
  dest: 'BB',
  mfnSourceKey: 'duties.bb.official.mfn_excel',
  ftaSourceKey: 'duties.bb.official.fta_excel',
  mfnEnvVar: 'BB_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BB_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBbMfnOfficial = commands.mfn;
export const dutiesBbFtaOfficial = commands.fta;
export const dutiesBbAllOfficial = commands.all;
