import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'eh',
  dest: 'EH',
  mfnSourceKey: 'duties.eh.official.mfn_excel',
  ftaSourceKey: 'duties.eh.official.fta_excel',
  mfnEnvVar: 'EH_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'EH_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesEhMfnOfficial = commands.mfn;
export const dutiesEhFtaOfficial = commands.fta;
export const dutiesEhAllOfficial = commands.all;
