import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'si',
  dest: 'SI',
  mfnSourceKey: 'duties.si.official.mfn_excel',
  ftaSourceKey: 'duties.si.official.fta_excel',
  mfnEnvVar: 'SI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSiMfnOfficial = commands.mfn;
export const dutiesSiFtaOfficial = commands.fta;
export const dutiesSiAllOfficial = commands.all;
