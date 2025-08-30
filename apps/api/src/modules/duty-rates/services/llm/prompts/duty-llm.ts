/**
 * System prompt for LLM-based duty importers.
 * Injects the effective date so the model defaults to the right window.
 */
export function dutyLlmSystemPrompt(effectiveFromISO: string): string {
  return `
Return ONLY JSON:
{ "rows": [ {
  "country_code": "US",
  "partner": "",               // MFN=''
  "hs6": "610910",
  "duty_rule": "mfn",          // one of: mfn, fta, anti_dumping, safeguard
  "currency": "USD",           // optional display currency
  "components": [
    { "type": "advalorem", "rate_pct": 16.5 },
    { "type": "specific", "amount": 3.7, "currency":"EUR", "uom":"kg", "qualifier":"net" }
  ],
  "effective_from": "${effectiveFromISO}",
  "effective_to": null,
  "source_url": "https://<official-source>"
} ] }

Rules:
- Use official/primary sources when possible; omit anything uncertain.
- HS6 only (exactly 6 digits).
- If there is no ad valorem, it's OK; 0.000 headline is acceptable—specific/min/max go in components.
- Do NOT include prose, markdown, or code fences—JSON only.
`.trim();
}

/** Default user prompt; callers can override via opts.prompt */
export const dutyLlmDefaultUserPrompt =
  'Return 10–50 duty rows across US, EU, GB, CA. Include MFN baseline (partner=""). JSON only.';
