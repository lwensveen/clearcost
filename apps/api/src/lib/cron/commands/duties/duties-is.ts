import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'is',
  dest: 'IS',
  mfnSourceKey: 'duties.is.official.mfn_excel',
  ftaSourceKey: 'duties.is.official.fta_excel',
  mfnEnvVar: 'IS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesIsMfnOfficial = commands.mfn;
export const dutiesIsFtaOfficial = commands.fta;
export const dutiesIsAllOfficial = commands.all;
