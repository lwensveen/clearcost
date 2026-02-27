import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'de',
  dest: 'DE',
  mfnSourceKey: 'duties.de.official.mfn_excel',
  ftaSourceKey: 'duties.de.official.fta_excel',
  mfnEnvVar: 'DE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'DE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesDeMfnOfficial = commands.mfn;
export const dutiesDeFtaOfficial = commands.fta;
export const dutiesDeAllOfficial = commands.all;
