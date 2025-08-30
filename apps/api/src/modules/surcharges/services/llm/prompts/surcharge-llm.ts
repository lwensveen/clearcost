export const surchargeLlmSystemPrompt = (efISO: string) =>
  `
Return ONLY JSON with this exact shape (no prose, no markdown, no code fences):

{
  "rows": [
    {
      "country_code": "US",          // ISO-3166-1 alpha-2 destination
      "origin_code": null,           // ISO-3166-1 alpha-2 when origin-specific; otherwise null
      "hs6": null,                   // EXACTLY 6 digits for product-specific surcharges; otherwise null
      "surcharge_code": "MPF",       // e.g., MPF, HMF, AQI_TRUCK_SINGLE, FDA_VQIP_USER_FEE_ANNUAL, etc.
      "rate_type": "ad_valorem",     // one of: "ad_valorem" | "fixed" | "unit"
      "pct_decimal": 0.003464,       // REQUIRED when rate_type="ad_valorem"; decimal fraction (0.003464 = 0.3464%)
      "fixed_amount": null,          // REQUIRED when rate_type="fixed"; currency amount
      "unit_amount": null,           // REQUIRED when rate_type="unit"; currency per unit
      "unit_code": null,             // Unit for "unit" rates, e.g., "UNIT","KG","HOUR"
      "currency": "USD",             // ISO-4217; REQUIRED when any amount fields present
      "min_amount": 26.22,           // optional floor (currency)
      "max_amount": 528.33,          // optional cap (currency)
      "apply_level": "entry",        // one of: "entry" | "line" | "shipment" | "program"
      "value_basis": "customs",      // usually "customs" (declared value basis)
      "transport_mode": "ALL",       // one of: "ALL" | "OCEAN" | "AIR" | "TRUCK" | "RAIL"
      "effective_from": "${efISO}",  // YYYY-MM-DD; default to ${efISO} unless official source states a start date
      "effective_to": null,          // null if still in force; else YYYY-MM-DD when it ended
      "source_url": "https://<official-source>", // MUST substantiate the amounts / rules
      "notes": null                  // optional clarifications (e.g., exemptions, ranges, legal cite)
    }
  ]
}

Authoritative data & sourcing:
- PRIORITIZE official sources: national customs/tax/agency sites (e.g., CBP, CBSA, USDA/APHIS, FDA, GOV.UK, EUR-Lex/Europa).
- If only reputable secondary sources exist (e.g., carriers or broker advisories like Maersk, DHL, Avalara), use them conservatively and set a brief explanation in "notes".
- Every row MUST include a working "source_url".

Content rules:
- Use "hs6" ONLY for product-specific surcharges; otherwise set hs6 = null.
- Use local currency for fixed/unit/min/max amounts (do NOT FX convert).
- rate_type field drives required fields:
  - "ad_valorem": require "pct_decimal" (decimal fraction).
  - "fixed": require "fixed_amount" and "currency".
  - "unit": require "unit_amount", "unit_code" and "currency".
- Optional "min_amount"/"max_amount" can be included for floors/ceilings when specified by the source.
- One row per unique (country_code, origin_code, hs6, transport_mode, apply_level, surcharge_code, effective_from).
- When a surcharge applies to all origins, set origin_code = null.

Change detection:
- If the request asks for “changes since ${efISO}”, return ONLY rows with effective_from ≥ ${efISO} or surcharges that ended on/after ${efISO} (include effective_to for ended rows).

Output contract:
- Output valid JSON only. No commentary, explanations, or extra fields.
`.trim();

export const surchargeLlmDefaultUserPrompt =
  'Return surcharge rows for as many countries as possible (US, EU members, GB, CA, AU, JP, CN, MX, BR, IN, ZA, KR, etc.). Include government-imposed fees such as MPF/HMF (US), AQI/APHIS charges, FDA/FSMA user fees, customs processing/handling/security fees, and clearly documented program-level fees. Use the JSON schema and rules provided by the system prompt. JSON only.';
