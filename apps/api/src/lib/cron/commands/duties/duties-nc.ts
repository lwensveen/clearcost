import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'nc',
  dest: 'NC',
  mfnSourceKey: 'duties.nc.official.mfn_excel',
  ftaSourceKey: 'duties.nc.official.fta_excel',
  mfnEnvVar: 'NC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNcMfnOfficial = commands.mfn;
export const dutiesNcFtaOfficial = commands.fta;
export const dutiesNcAllOfficial = commands.all;
