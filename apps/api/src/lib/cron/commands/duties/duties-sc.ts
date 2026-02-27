import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sc',
  dest: 'SC',
  mfnSourceKey: 'duties.sc.official.mfn_excel',
  ftaSourceKey: 'duties.sc.official.fta_excel',
  mfnEnvVar: 'SC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesScMfnOfficial = commands.mfn;
export const dutiesScFtaOfficial = commands.fta;
export const dutiesScAllOfficial = commands.all;
