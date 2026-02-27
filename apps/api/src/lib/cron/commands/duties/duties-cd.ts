import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cd',
  dest: 'CD',
  mfnSourceKey: 'duties.cd.official.mfn_excel',
  ftaSourceKey: 'duties.cd.official.fta_excel',
  mfnEnvVar: 'CD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCdMfnOfficial = commands.mfn;
export const dutiesCdFtaOfficial = commands.fta;
export const dutiesCdAllOfficial = commands.all;
