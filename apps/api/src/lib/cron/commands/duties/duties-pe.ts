import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pe',
  dest: 'PE',
  mfnSourceKey: 'duties.pe.official.mfn_excel',
  ftaSourceKey: 'duties.pe.official.fta_excel',
  mfnEnvVar: 'PE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPeMfnOfficial = commands.mfn;
export const dutiesPeFtaOfficial = commands.fta;
export const dutiesPeAllOfficial = commands.all;
