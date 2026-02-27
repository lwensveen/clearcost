import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 've',
  dest: 'VE',
  mfnSourceKey: 'duties.ve.official.mfn_excel',
  ftaSourceKey: 'duties.ve.official.fta_excel',
  mfnEnvVar: 'VE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'VE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesVeMfnOfficial = commands.mfn;
export const dutiesVeFtaOfficial = commands.fta;
export const dutiesVeAllOfficial = commands.all;
