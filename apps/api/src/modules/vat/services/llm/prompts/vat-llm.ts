export function vatLlmSystemPrompt(effectiveFromISO: string) {
  return `
Return ONLY JSON in this exact shape:

{
  "rows": [
    {
      "country_code": "GB",
      "vat_rate_kind": "STANDARD",          // STANDARD | REDUCED | SUPER_REDUCED | ZERO
      "vat_base": "CIF_PLUS_DUTY",          // CIF | CIF_PLUS_DUTY (imports VAT base)
      "rate_pct": 20,                       // number in percent units
      "effective_from": "${effectiveFromISO}",
      "effective_to": null,
      "source_url": "https://<official-source>",
      "notes": null
    }
  ]
}

Rules:
- Use official sources when possible (government, europa.eu, etc.). Omit any row you're unsure about.
- country_code must be ISO-3166-1 alpha-2.
- Rate is in percent units (e.g., 21 means 21%).
- Pick the current, broadly applicable national VAT/GST for imports; you may also include REDUCED/SUPER_REDUCED/ZERO kinds when clearly documented.
- Default vat_base to CIF_PLUS_DUTY unless the destination explicitly uses CIF.
- Output JSON only. No commentary.
`.trim();
}

export const vatLlmDefaultUserPrompt =
  'Return 20–80 VAT rows across US, EU, GB, CA, AU, NZ, and a mix of others; include STANDARD plus any clearly documented REDUCED/ZERO. JSON only.';
