import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ad',
  dest: 'AD',
  mfnSourceKey: 'duties.ad.official.mfn_excel',
  ftaSourceKey: 'duties.ad.official.fta_excel',
  mfnEnvVar: 'AD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAdMfnOfficial = commands.mfn;
export const dutiesAdFtaOfficial = commands.fta;
export const dutiesAdAllOfficial = commands.all;
