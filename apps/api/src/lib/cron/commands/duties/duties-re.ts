import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 're',
  dest: 'RE',
  mfnSourceKey: 'duties.re.official.mfn_excel',
  ftaSourceKey: 'duties.re.official.fta_excel',
  mfnEnvVar: 'RE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'RE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesReMfnOfficial = commands.mfn;
export const dutiesReFtaOfficial = commands.fta;
export const dutiesReAllOfficial = commands.all;
