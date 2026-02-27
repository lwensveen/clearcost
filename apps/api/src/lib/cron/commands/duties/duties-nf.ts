import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'nf',
  dest: 'NF',
  mfnSourceKey: 'duties.nf.official.mfn_excel',
  ftaSourceKey: 'duties.nf.official.fta_excel',
  mfnEnvVar: 'NF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNfMfnOfficial = commands.mfn;
export const dutiesNfFtaOfficial = commands.fta;
export const dutiesNfAllOfficial = commands.all;
