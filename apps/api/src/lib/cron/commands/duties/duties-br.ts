import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'br',
  dest: 'BR',
  mfnSourceKey: 'duties.br.official.mfn_excel',
  ftaSourceKey: 'duties.br.official.fta_excel',
  mfnEnvVar: 'BR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBrMfnOfficial = commands.mfn;
export const dutiesBrFtaOfficial = commands.fta;
export const dutiesBrAllOfficial = commands.all;
