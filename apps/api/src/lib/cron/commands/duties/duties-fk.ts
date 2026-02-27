import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'fk',
  dest: 'FK',
  mfnSourceKey: 'duties.fk.official.mfn_excel',
  ftaSourceKey: 'duties.fk.official.fta_excel',
  mfnEnvVar: 'FK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'FK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesFkMfnOfficial = commands.mfn;
export const dutiesFkFtaOfficial = commands.fta;
export const dutiesFkAllOfficial = commands.all;
