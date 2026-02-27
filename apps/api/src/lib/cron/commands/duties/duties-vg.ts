import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'vg',
  dest: 'VG',
  mfnSourceKey: 'duties.vg.official.mfn_excel',
  ftaSourceKey: 'duties.vg.official.fta_excel',
  mfnEnvVar: 'VG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'VG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesVgMfnOfficial = commands.mfn;
export const dutiesVgFtaOfficial = commands.fta;
export const dutiesVgAllOfficial = commands.all;
