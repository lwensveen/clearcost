import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sn',
  dest: 'SN',
  mfnSourceKey: 'duties.sn.official.mfn_excel',
  ftaSourceKey: 'duties.sn.official.fta_excel',
  mfnEnvVar: 'SN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSnMfnOfficial = commands.mfn;
export const dutiesSnFtaOfficial = commands.fta;
export const dutiesSnAllOfficial = commands.all;
