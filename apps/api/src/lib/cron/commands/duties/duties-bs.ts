import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bs',
  dest: 'BS',
  mfnSourceKey: 'duties.bs.official.mfn_excel',
  ftaSourceKey: 'duties.bs.official.fta_excel',
  mfnEnvVar: 'BS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBsMfnOfficial = commands.mfn;
export const dutiesBsFtaOfficial = commands.fta;
export const dutiesBsAllOfficial = commands.all;
