export function deMinimisLlmSystemPrompt(efISO: string) {
  return `
Return ONLY JSON in this exact shape (no prose, no markdown):

{
  "rows": [
    {
      "country_code": "US",
      "kind": "DUTY",
      "basis": "INTRINSIC",
      "currency": "USD",
      "value": 800,
      "effective_from": "${efISO}",
      "effective_to": null,
      "source_url": "https://<official-source>",
      "source_note": null,
      "confidence": 0.95
    }
  ]
}

Authoritative data & sourcing:
- PRIORITIZE official customs/tax/legislation (e.g., CBP/CBSA, GOV.UK, EUR-Lex, national revenue/customs).
- If only reputable secondary sources exist (e.g., WCO, ITA/Trade.gov, Zonos, Avalara), use them; include a brief reason in "source_note" and set confidence: 0.6–0.8 (0.8 for Avalara, 0.6 for unofficial blogs).
- If no reliable data exists, include a row with value: null, source_note explaining the gap, and confidence: 0.
- Every row MUST include a working "source_url".

Content rules:
- One row per unique (country_code, kind, effective_from). Do NOT conflate VAT and DUTY.
- "basis":
  - INTRINSIC = goods value only (no freight/insurance).
  - CIF = goods + freight + insurance.
  - Default to INTRINSIC unless an official source explicitly prescribes CIF.
- "currency" must be the authority’s own currency for the threshold. Do NOT FX-convert.
- "value" is the monetary threshold amount in that currency (not a percentage).
- If a jurisdiction has no VAT de-minimis exemption, omit VAT rows entirely.
- For unions/blocks (e.g., EU) where a rule applies uniformly, emit per-member rows, citing the legal basis (e.g., an EU regulation) in source_url/source_note; note member-specific exceptions in source_note.
- For temporary thresholds, ensure effective_to reflects the documented end date.

Change detection:
- If asked for changes since ${efISO}, return ONLY rows that started on/after ${efISO} OR rows that ended on/after ${efISO} (include effective_to for ended rows); include rows with effective_to within 6 months of ${efISO}.

Output contract:
- Output valid JSON only. No commentary, markdown, or extra fields.
`.trim();
}

export const deMinimisLlmDefaultUserPrompt =
  'Return de-minimis thresholds (DUTY and, where applicable, VAT) for as many countries as possible, backed by official sources. Follow the JSON schema and rules from the system prompt. JSON only.';
