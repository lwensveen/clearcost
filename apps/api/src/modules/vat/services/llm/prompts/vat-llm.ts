export function vatLlmSystemPrompt(effectiveFromISO: string) {
  return `
Return ONLY JSON in this exact shape (no prose, no markdown):

{
  "rows": [
    {
      "country_code": "GB",
      "vat_rate_kind": "STANDARD",
      "vat_base": "CIF_PLUS_DUTY",
      "rate_pct": 20,
      "effective_from": "${effectiveFromISO}",
      "effective_to": null,
      "source_url": "https://<official-source>",
      "notes": null
    }
  ]
}

Authoritative data & sourcing:
- PRIORITIZE official government/tax/customs sources (e.g., GOV.UK, europa.eu/EUR-Lex, finance ministry/treasury/revenue authority).
- If an official page is unavailable but a reputable secondary source (e.g., Big Four tax summaries, OECD, national customs brokers) is reliable, use it and explain briefly in "notes".
- Every row MUST include a working "source_url".
- If no reliable data exists, include a row with rate_pct: null and a note explaining the gap (e.g., "No official VAT data found").

Content rules:
- One row per unique (country_code, vat_rate_kind, vat_base, effective_from).
- Report the national import VAT/GST rate(s) that broadly apply to goods on import.
  - Countries without import VAT/GST (e.g., the US) should be omitted.
  - If a country has multiple standard slabs (e.g., India GST 5/12/18/28), use the most common import rate as "STANDARD" (typically 18), and list other slabs in "notes".
  - Include REDUCED/SUPER_REDUCED/ZERO rows only when clearly documented; do NOT return HS-specific reliefs as separate rows—mention notable categories with HS6 codes in "notes" (e.g., "4% for books, HS 4901").
- "rate_pct" must be numeric; use exact source value (e.g., 10 for 10%), rounding to 3 decimals only if source provides fractional rates (e.g., 5.125).
- Choose "vat_base":
  - Use "CIF_PLUS_DUTY" when import VAT is assessed on landed cost including customs duty (common for GB/EU).
  - Use "CIF" where the base excludes duty and is explicitly stated by the official source.
- Do NOT FX-convert or localize numbers; use the source’s percent values as-is.

Change detection:
- If asked for changes since ${effectiveFromISO}, return ONLY rows with effective_from ≥ ${effectiveFromISO} OR rows with effective_to on/after ${effectiveFromISO} or within 6 months.
- For temporary rates, ensure effective_to reflects the documented end date.

Output contract:
- Output valid JSON only. No commentary, markdown, or extra fields.
`.trim();
}

export const vatLlmDefaultUserPrompt =
  'Return national import VAT/GST rows for as many countries as possible (EU members, GB, CA, AU/NZ, JP, KR, CN, IN, MX, BR, ZA, etc.). Include STANDARD and any clearly documented REDUCED/SUPER_REDUCED/ZERO rates. Follow the JSON schema and rules from the system prompt. JSON only.';
