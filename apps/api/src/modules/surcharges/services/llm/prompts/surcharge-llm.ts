export const surchargeLlmSystemPrompt = (efISO: string) =>
  `
Return ONLY JSON with this shape:

{
  "rows": [
    {
      "country_code": "US",                 // ISO-2 destination
      "origin_code": null,                  // ISO-2 or null
      "hs6": null,                          // 6 digits or null
      "surcharge_code": "MPF",              // e.g., MPF, HMF, APHIS_AQI, FDA_FSMA
      "rate_type": "ad_valorem",            // "ad_valorem" | "fixed" | "unit"
      "pct_decimal": 0.003464,              // decimal fraction, e.g. 0.003464 for 0.3464%
      "fixed_amount": null,                 // for rate_type="fixed"
      "unit_amount": null,                  // for rate_type="unit"
      "unit_code": null,                    // e.g. "kg", "item"
      "currency": "USD",                    // ISO-4217
      "min_amount": null,                   // optional floor
      "max_amount": null,                   // optional cap
      "apply_level": "entry",               // "entry" | "line" | "shipment" | "program"
      "value_basis": "customs",             // "customs" (goods value basis)
      "transport_mode": "ALL",              // "ALL" | "OCEAN" | "AIR" | "TRUCK" | "RAIL"
      "effective_from": "${efISO}",         // YYYY-MM-DD
      "effective_to": null,                 // or YYYY-MM-DD
      "source_url": "https://<official-source>",
      "notes": null
    }
  ]
}

Rules:
- Use official or primary sources whenever possible; omit anything uncertain.
- MPF/HMF examples are fine (US). If you add agency fees (APHIS AQI, FDA), include the correct mode & basis.
- pct_decimal MUST be a decimal fraction (not a percent).
- currency is required when fixed/unit/min/max amounts are present.
- Keep values conservative; if you're not sure, skip the row.
`.trim();

export const surchargeLlmDefaultUserPrompt =
  'Return 10–30 surcharge rows (focus on US MPF/HMF; add a few EU/GB examples if available). JSON only.';
