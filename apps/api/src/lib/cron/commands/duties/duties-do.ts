import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'do',
  dest: 'DO',
  mfnSourceKey: 'duties.do.official.mfn_excel',
  ftaSourceKey: 'duties.do.official.fta_excel',
  mfnEnvVar: 'DO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'DO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesDoMfnOfficial = commands.mfn;
export const dutiesDoFtaOfficial = commands.fta;
export const dutiesDoAllOfficial = commands.all;
