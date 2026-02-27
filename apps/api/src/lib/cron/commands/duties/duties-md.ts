import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'md',
  dest: 'MD',
  mfnSourceKey: 'duties.md.official.mfn_excel',
  ftaSourceKey: 'duties.md.official.fta_excel',
  mfnEnvVar: 'MD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMdMfnOfficial = commands.mfn;
export const dutiesMdFtaOfficial = commands.fta;
export const dutiesMdAllOfficial = commands.all;
