import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tf',
  dest: 'TF',
  mfnSourceKey: 'duties.tf.official.mfn_excel',
  ftaSourceKey: 'duties.tf.official.fta_excel',
  mfnEnvVar: 'TF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTfMfnOfficial = commands.mfn;
export const dutiesTfFtaOfficial = commands.fta;
export const dutiesTfAllOfficial = commands.all;
