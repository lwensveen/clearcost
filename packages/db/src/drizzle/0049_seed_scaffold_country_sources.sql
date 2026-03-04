-- Seed source_registry entries for scaffold country duty sources.
-- Each country gets an MFN and FTA entry so that resolveSourceDownloadUrl()
-- finds a row instead of relying on the env-var-only fallback path.
INSERT INTO "source_registry" (
  "key",
  "dataset",
  "source_type",
  "base_url",
  "download_url_template",
  "schedule_hint",
  "expected_format",
  "auth_strategy",
  "sla_max_age_hours",
  "notes",
  "last_verified_at"
)
VALUES
  -- Andorra (AD)
  ('duties.ad.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Andorra official MFN workbook; URL supplied at run time or via AD_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ad.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Andorra official preferential duties workbook; URL supplied at run time or via AD_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- United Arab Emirates (AE)
  ('duties.ae.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'UAE official MFN workbook; URL supplied at run time or via AE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ae.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'UAE official preferential duties workbook; URL supplied at run time or via AE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Afghanistan (AF)
  ('duties.af.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Afghanistan official MFN workbook; URL supplied at run time or via AF_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.af.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Afghanistan official preferential duties workbook; URL supplied at run time or via AF_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Antigua and Barbuda (AG)
  ('duties.ag.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Antigua and Barbuda official MFN workbook; URL supplied at run time or via AG_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ag.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Antigua and Barbuda official preferential duties workbook; URL supplied at run time or via AG_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Anguilla (AI)
  ('duties.ai.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Anguilla official MFN workbook; URL supplied at run time or via AI_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ai.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Anguilla official preferential duties workbook; URL supplied at run time or via AI_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Albania (AL)
  ('duties.al.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Albania official MFN workbook; URL supplied at run time or via AL_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.al.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Albania official preferential duties workbook; URL supplied at run time or via AL_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Armenia (AM)
  ('duties.am.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Armenia official MFN workbook; URL supplied at run time or via AM_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.am.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Armenia official preferential duties workbook; URL supplied at run time or via AM_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Angola (AO)
  ('duties.ao.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Angola official MFN workbook; URL supplied at run time or via AO_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ao.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Angola official preferential duties workbook; URL supplied at run time or via AO_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Antarctica (AQ)
  ('duties.aq.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Antarctica official MFN workbook; URL supplied at run time or via AQ_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.aq.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Antarctica official preferential duties workbook; URL supplied at run time or via AQ_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Argentina (AR)
  ('duties.ar.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Argentina official MFN workbook; URL supplied at run time or via AR_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ar.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Argentina official preferential duties workbook; URL supplied at run time or via AR_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- American Samoa (AS)
  ('duties.as.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'American Samoa official MFN workbook; URL supplied at run time or via AS_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.as.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'American Samoa official preferential duties workbook; URL supplied at run time or via AS_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Austria (AT)
  ('duties.at.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Austria official MFN workbook; URL supplied at run time or via AT_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.at.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Austria official preferential duties workbook; URL supplied at run time or via AT_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Australia (AU)
  ('duties.au.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Australia official MFN workbook; URL supplied at run time or via AU_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.au.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Australia official preferential duties workbook; URL supplied at run time or via AU_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Aruba (AW)
  ('duties.aw.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Aruba official MFN workbook; URL supplied at run time or via AW_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.aw.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Aruba official preferential duties workbook; URL supplied at run time or via AW_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Bangladesh (BD)
  ('duties.bd.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Bangladesh official MFN workbook; URL supplied at run time or via BD_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.bd.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Bangladesh official preferential duties workbook; URL supplied at run time or via BD_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Belgium (BE)
  ('duties.be.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Belgium official MFN workbook; URL supplied at run time or via BE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.be.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Belgium official preferential duties workbook; URL supplied at run time or via BE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Bulgaria (BG)
  ('duties.bg.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Bulgaria official MFN workbook; URL supplied at run time or via BG_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.bg.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Bulgaria official preferential duties workbook; URL supplied at run time or via BG_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Brazil (BR)
  ('duties.br.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Brazil official MFN workbook; URL supplied at run time or via BR_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.br.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Brazil official preferential duties workbook; URL supplied at run time or via BR_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Canada (CA)
  ('duties.ca.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Canada official MFN workbook; URL supplied at run time or via CA_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ca.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Canada official preferential duties workbook; URL supplied at run time or via CA_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Switzerland (CH)
  ('duties.ch.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Switzerland official MFN workbook; URL supplied at run time or via CH_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ch.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Switzerland official preferential duties workbook; URL supplied at run time or via CH_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Chile (CL)
  ('duties.cl.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Chile official MFN workbook; URL supplied at run time or via CL_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.cl.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Chile official preferential duties workbook; URL supplied at run time or via CL_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Colombia (CO)
  ('duties.co.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Colombia official MFN workbook; URL supplied at run time or via CO_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.co.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Colombia official preferential duties workbook; URL supplied at run time or via CO_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Cyprus (CY)
  ('duties.cy.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Cyprus official MFN workbook; URL supplied at run time or via CY_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.cy.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Cyprus official preferential duties workbook; URL supplied at run time or via CY_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Czech Republic (CZ)
  ('duties.cz.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Czech Republic official MFN workbook; URL supplied at run time or via CZ_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.cz.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Czech Republic official preferential duties workbook; URL supplied at run time or via CZ_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Germany (DE)
  ('duties.de.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Germany official MFN workbook; URL supplied at run time or via DE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.de.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Germany official preferential duties workbook; URL supplied at run time or via DE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Denmark (DK)
  ('duties.dk.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Denmark official MFN workbook; URL supplied at run time or via DK_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.dk.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Denmark official preferential duties workbook; URL supplied at run time or via DK_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Estonia (EE)
  ('duties.ee.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Estonia official MFN workbook; URL supplied at run time or via EE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ee.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Estonia official preferential duties workbook; URL supplied at run time or via EE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Egypt (EG)
  ('duties.eg.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Egypt official MFN workbook; URL supplied at run time or via EG_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.eg.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Egypt official preferential duties workbook; URL supplied at run time or via EG_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Spain (ES)
  ('duties.es.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Spain official MFN workbook; URL supplied at run time or via ES_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.es.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Spain official preferential duties workbook; URL supplied at run time or via ES_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Finland (FI)
  ('duties.fi.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Finland official MFN workbook; URL supplied at run time or via FI_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.fi.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Finland official preferential duties workbook; URL supplied at run time or via FI_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- France (FR)
  ('duties.fr.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'France official MFN workbook; URL supplied at run time or via FR_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.fr.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'France official preferential duties workbook; URL supplied at run time or via FR_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Ghana (GH)
  ('duties.gh.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Ghana official MFN workbook; URL supplied at run time or via GH_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.gh.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Ghana official preferential duties workbook; URL supplied at run time or via GH_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Greece (GR)
  ('duties.gr.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Greece official MFN workbook; URL supplied at run time or via GR_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.gr.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Greece official preferential duties workbook; URL supplied at run time or via GR_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Croatia (HR)
  ('duties.hr.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Croatia official MFN workbook; URL supplied at run time or via HR_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.hr.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Croatia official preferential duties workbook; URL supplied at run time or via HR_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Hungary (HU)
  ('duties.hu.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Hungary official MFN workbook; URL supplied at run time or via HU_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.hu.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Hungary official preferential duties workbook; URL supplied at run time or via HU_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Ireland (IE)
  ('duties.ie.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Ireland official MFN workbook; URL supplied at run time or via IE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ie.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Ireland official preferential duties workbook; URL supplied at run time or via IE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Israel (IL)
  ('duties.il.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Israel official MFN workbook; URL supplied at run time or via IL_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.il.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Israel official preferential duties workbook; URL supplied at run time or via IL_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- India (IN)
  ('duties.in.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'India official MFN workbook; URL supplied at run time or via IN_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.in.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'India official preferential duties workbook; URL supplied at run time or via IN_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Iceland (IS)
  ('duties.is.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Iceland official MFN workbook; URL supplied at run time or via IS_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.is.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Iceland official preferential duties workbook; URL supplied at run time or via IS_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Italy (IT)
  ('duties.it.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Italy official MFN workbook; URL supplied at run time or via IT_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.it.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Italy official preferential duties workbook; URL supplied at run time or via IT_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Kenya (KE)
  ('duties.ke.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Kenya official MFN workbook; URL supplied at run time or via KE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ke.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Kenya official preferential duties workbook; URL supplied at run time or via KE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Liechtenstein (LI)
  ('duties.li.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Liechtenstein official MFN workbook; URL supplied at run time or via LI_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.li.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Liechtenstein official preferential duties workbook; URL supplied at run time or via LI_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Lithuania (LT)
  ('duties.lt.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Lithuania official MFN workbook; URL supplied at run time or via LT_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.lt.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Lithuania official preferential duties workbook; URL supplied at run time or via LT_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Luxembourg (LU)
  ('duties.lu.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Luxembourg official MFN workbook; URL supplied at run time or via LU_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.lu.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Luxembourg official preferential duties workbook; URL supplied at run time or via LU_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Latvia (LV)
  ('duties.lv.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Latvia official MFN workbook; URL supplied at run time or via LV_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.lv.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Latvia official preferential duties workbook; URL supplied at run time or via LV_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Malta (MT)
  ('duties.mt.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Malta official MFN workbook; URL supplied at run time or via MT_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.mt.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Malta official preferential duties workbook; URL supplied at run time or via MT_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Mexico (MX)
  ('duties.mx.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Mexico official MFN workbook; URL supplied at run time or via MX_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.mx.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Mexico official preferential duties workbook; URL supplied at run time or via MX_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Nigeria (NG)
  ('duties.ng.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Nigeria official MFN workbook; URL supplied at run time or via NG_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ng.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Nigeria official preferential duties workbook; URL supplied at run time or via NG_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Netherlands (NL)
  ('duties.nl.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Netherlands official MFN workbook; URL supplied at run time or via NL_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.nl.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Netherlands official preferential duties workbook; URL supplied at run time or via NL_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Norway (NO)
  ('duties.no.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Norway official MFN workbook; URL supplied at run time or via NO_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.no.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Norway official preferential duties workbook; URL supplied at run time or via NO_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- New Zealand (NZ)
  ('duties.nz.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'New Zealand official MFN workbook; URL supplied at run time or via NZ_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.nz.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'New Zealand official preferential duties workbook; URL supplied at run time or via NZ_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Panama (PA)
  ('duties.pa.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Panama official MFN workbook; URL supplied at run time or via PA_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.pa.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Panama official preferential duties workbook; URL supplied at run time or via PA_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Peru (PE)
  ('duties.pe.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Peru official MFN workbook; URL supplied at run time or via PE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.pe.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Peru official preferential duties workbook; URL supplied at run time or via PE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Pakistan (PK)
  ('duties.pk.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Pakistan official MFN workbook; URL supplied at run time or via PK_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.pk.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Pakistan official preferential duties workbook; URL supplied at run time or via PK_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Poland (PL)
  ('duties.pl.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Poland official MFN workbook; URL supplied at run time or via PL_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.pl.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Poland official preferential duties workbook; URL supplied at run time or via PL_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Portugal (PT)
  ('duties.pt.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Portugal official MFN workbook; URL supplied at run time or via PT_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.pt.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Portugal official preferential duties workbook; URL supplied at run time or via PT_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Romania (RO)
  ('duties.ro.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Romania official MFN workbook; URL supplied at run time or via RO_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ro.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Romania official preferential duties workbook; URL supplied at run time or via RO_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Russia (RU)
  ('duties.ru.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Russia official MFN workbook; URL supplied at run time or via RU_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ru.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Russia official preferential duties workbook; URL supplied at run time or via RU_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Saudi Arabia (SA)
  ('duties.sa.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Saudi Arabia official MFN workbook; URL supplied at run time or via SA_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.sa.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Saudi Arabia official preferential duties workbook; URL supplied at run time or via SA_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Sweden (SE)
  ('duties.se.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Sweden official MFN workbook; URL supplied at run time or via SE_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.se.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Sweden official preferential duties workbook; URL supplied at run time or via SE_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Slovenia (SI)
  ('duties.si.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Slovenia official MFN workbook; URL supplied at run time or via SI_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.si.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Slovenia official preferential duties workbook; URL supplied at run time or via SI_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Slovakia (SK)
  ('duties.sk.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Slovakia official MFN workbook; URL supplied at run time or via SK_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.sk.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Slovakia official preferential duties workbook; URL supplied at run time or via SK_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Turkey (TR)
  ('duties.tr.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Turkey official MFN workbook; URL supplied at run time or via TR_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.tr.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Turkey official preferential duties workbook; URL supplied at run time or via TR_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Taiwan (TW)
  ('duties.tw.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Taiwan official MFN workbook; URL supplied at run time or via TW_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.tw.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Taiwan official preferential duties workbook; URL supplied at run time or via TW_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- Ukraine (UA)
  ('duties.ua.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Ukraine official MFN workbook; URL supplied at run time or via UA_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.ua.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'Ukraine official preferential duties workbook; URL supplied at run time or via UA_FTA_OFFICIAL_EXCEL_URL.', NOW()),

  -- South Africa (ZA)
  ('duties.za.official.mfn_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'South Africa official MFN workbook; URL supplied at run time or via ZA_MFN_OFFICIAL_EXCEL_URL.', NOW()),
  ('duties.za.official.fta_excel', 'duties', 'xlsx', NULL, NULL, 'manual', 'xlsx', 'none', 720,
   'South Africa official preferential duties workbook; URL supplied at run time or via ZA_FTA_OFFICIAL_EXCEL_URL.', NOW())

ON CONFLICT ("key") DO NOTHING;
