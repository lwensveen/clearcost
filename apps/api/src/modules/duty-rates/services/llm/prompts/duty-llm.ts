export function dutyLlmSystemPrompt(effectiveFromISO: string): string {
  return `
Return ONLY JSON with this exact shape (no prose, no markdown, no code fences):

{
  "rows": [
    {
      "country_code": "US",
      "partner": "",
      "hs6": "610910",
      "duty_rule": "mfn",
      "currency": "USD",
      "components": [
        { "type": "advalorem", "rate_pct": 16.5 },
        { "type": "specific", "amount": 3.7, "currency": "EUR", "uom": "kg", "qualifier": "net" }
      ],
      "effective_from": "${effectiveFromISO}",
      "effective_to": null,
      "source_url": "https://<official-source>"
    }
  ]
}

Authoritative data & sourcing:
- PRIORITIZE official sources: national customs/tax authorities, consolidated legislation, tariff databases (USITC/HTS, TARIC, GOV.UK), WTO, EUR-Lex.
- If only reputable secondary sources exist (e.g., WCO, ITA/Trade.gov, Flexport/Avalara), use them only when HS6 and duty are clear, prioritizing tariff databases (e.g., Flexport) over aggregators (e.g., Avalara); note in source_url.
- If no reliable data exists, include a row with components: [] and source_url noting the gap (e.g., "No official tariff data").
- Every row MUST include a working "source_url".

Content rules:
- HS6 ONLY (exactly 6 digits). If a list of HS6 codes is provided (e.g., 100 codes), prioritize those; otherwise, select a representative sample of 100–500 HS6 codes per country, focusing on commonly traded goods.
- "components" must encode all non-ad valorem pieces separately:
  - "advalorem": use "rate_pct" in PERCENT units (e.g., 16.5 means 16.5%).
  - "specific"/"minimum"/"maximum": include "amount" and "currency"; use "uom" (e.g., "kg", "item", "hl") and optional "qualifier" ("net", "gross", "100kg").
- If no ad valorem component, omit it; keep only specific/min/max components.
- "partner": "" for MFN/erga omnes and global remedies; for FTA/preferential, set to partner ISO-2.
- One row per unique (country_code, partner, hs6, duty_rule, effective_from).
- Use local currency for non-percent amounts (do not convert).
- For temporary duties (e.g., anti_dumping), ensure effective_to reflects the documented end date.

EU / regional blocs:
- If a regulation applies uniformly across members, emit per-destination rows citing the shared legal basis in source_url.

Change detection:
- If the request asks for “changes since ${effectiveFromISO}”, return ONLY rows with effective_from ≥ ${effectiveFromISO} or measures that ended on/after ${effectiveFromISO} (include effective_to for ended measures); include rows with effective_to within 6 months of ${effectiveFromISO}.

Output contract:
- Output valid JSON only. No commentary, explanations, or extra fields.
`.trim();
}

/** Default user prompt; callers can override via opts.prompt */
export const dutyLlmDefaultUserPrompt =
  'Return 100–500 representative HS6 duty rows per major destination (US, EU members, GB, CA, AU, JP, CN, MX, BR, IN, ZA, KR), covering MFN (partner="") and notable FTA/anti_dumping/safeguard measures when clearly documented. JSON only.';
