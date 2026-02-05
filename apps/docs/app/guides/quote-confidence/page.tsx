import { fetchCapabilities } from '../../../lib/capabilities';

export const dynamic = 'force-dynamic';

export default async function QuoteConfidenceGuidePage() {
  const capabilities = await fetchCapabilities();
  const datasetEntries = capabilities ? Object.entries(capabilities.datasets) : [];

  return (
    <main className="prose mx-auto px-6 py-10">
      <h1>Quote confidence and lane coverage</h1>
      <p>
        This guide explains what ClearCost currently covers, what is included in a quote, and how to
        interpret confidence fields.
      </p>

      <h2>Supported lanes (current)</h2>
      <ul>
        <li>
          <strong>Any origin → EU destination</strong> (duty + VAT + de-minimis + surcharges + FX)
        </li>
        <li>
          <strong>Any origin → US destination</strong> (duty + de-minimis + surcharges + FX)
        </li>
        <li>
          <strong>Any origin → UK destination</strong> (duty + VAT + surcharges + FX)
        </li>
      </ul>
      <p>
        Additional importers exist for ASEAN, CN and JP, but coverage may be incomplete depending on
        dataset freshness and partner/origin rule complexity.
      </p>

      <h2>Dataset capabilities (live from API)</h2>
      {capabilities ? (
        <>
          <p>
            This table is rendered from <code>/v1/_meta/capabilities</code> (
            <code>buildSha={capabilities.buildSha ?? 'unknown'}</code>).
          </p>
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Regions</th>
                <th>Scheduled</th>
                <th>Freshness threshold (hours)</th>
              </tr>
            </thead>
            <tbody>
              {datasetEntries.map(([dataset, info]) => (
                <tr key={dataset}>
                  <td>
                    <code>{dataset}</code>
                  </td>
                  <td>{info.supportedRegions.join(', ')}</td>
                  <td>{info.scheduled ? 'yes' : 'no'}</td>
                  <td>{info.freshnessThresholdHours ?? 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>
          Capabilities are unavailable because <code>CLEARCOST_API_URL</code> is not configured (or
          the API is unreachable). This page will render live capability data once connected.
        </p>
      )}

      <h2>What a quote includes</h2>
      <ul>
        <li>MFN-style duty lookup from current duty tables</li>
        <li>VAT/GST import tax lookup from VAT rules and overrides</li>
        <li>De-minimis suppression checks</li>
        <li>Surcharges/trade remedies when active for lane/HS scope</li>
        <li>FX conversion pinned to quote FX as-of date</li>
        <li>Freight using configured freight cards/steps</li>
      </ul>

      <h2>What is explicitly out of scope</h2>
      <ul>
        <li>FTA/origin qualification logic and origin proofs</li>
        <li>Restricted/prohibited goods compliance decisions</li>
        <li>Excise/special product tax regimes</li>
        <li>US state/local sales tax</li>
        <li>Broker/customs filing outcomes and legal rulings</li>
      </ul>

      <h2>Confidence fields</h2>
      <ul>
        <li>
          <code>componentConfidence</code> is reported for duty, VAT, surcharges, freight and FX.
        </li>
        <li>
          <code>authoritative</code> includes both “row found” and “no applicable match” (
          <code>no_match</code>), for example an empty surcharge list when nothing applies.
        </li>
        <li>
          <code>estimated</code> means out-of-scope or explicit defaults (for example unmodeled tax
          dimensions like US state/local sales tax).
        </li>
        <li>
          <code>missing</code> means dataset unavailable or lookup/runtime failure (
          <code>no_dataset</code> or <code>error</code>).
        </li>
        <li>
          <code>missingComponents</code> only lists components in a true missing state (plus FX
          fallback cases).
        </li>
        <li>
          <code>overallConfidence</code> is worst-of component confidence (
          <code>missing &gt; estimated &gt; authoritative</code>).
        </li>
        <li>
          If API strict freshness mode is enabled (<code>QUOTE_STRICT_FRESHNESS=1</code>), stale
          duty/VAT/surcharge/FX datasets are forced to <code>missing</code> and listed in{' '}
          <code>missingComponents</code>.
        </li>
        <li>
          <code>sources</code> only surfaces metadata already present in source records; unknown
          fields remain <code>null</code>.
        </li>
        <li>
          <code>explainability</code> returns lightweight “why” context for duty/VAT/de-minimis/
          surcharges/freight decisions.
        </li>
      </ul>

      <h2>Example request</h2>
      <pre>
        <code>{`POST /v1/quotes
{
  "origin": "JP",
  "dest": "US",
  "itemValue": { "amount": 120, "currency": "USD" },
  "dimsCm": { "l": 30, "w": 20, "h": 15 },
  "weightKg": 2.3,
  "categoryKey": "collectibles.figure",
  "mode": "air"
}`}</code>
      </pre>

      <h2>Example response</h2>
      <pre>
        <code>{`{
  "hs6": "950300",
  "currency": "USD",
  "incoterm": "DAP",
  "chargeableKg": 2.3,
  "freight": 18.7,
  "deMinimis": {
    "duty": { "thresholdDest": 800, "deMinimisBasis": "INTRINSIC", "under": true },
    "vat": null,
    "suppressDuty": true,
    "suppressVAT": false
  },
  "components": { "CIF": 138.7, "duty": 0, "vat": 0, "fees": 1.95 },
  "total": 140.65,
  "guaranteedMax": 143.46,
  "policy": "De minimis: duty not charged at import.",
  "componentConfidence": {
    "duty": "authoritative",
    "vat": "estimated",
    "surcharges": "authoritative",
    "freight": "authoritative",
    "fx": "authoritative"
  },
  "overallConfidence": "estimated",
  "missingComponents": [],
  "sources": {
    "duty": {
      "provider": null,
      "dataset": "official",
      "asOf": null,
      "effectiveFrom": "2025-01-01T00:00:00.000Z"
    },
    "vat": {
      "provider": null,
      "dataset": null,
      "asOf": null,
      "effectiveFrom": null
    },
    "surcharges": {
      "provider": null,
      "dataset": "USITC",
      "asOf": null,
      "effectiveFrom": "2025-01-01T00:00:00.000Z"
    }
  },
  "explainability": {
    "duty": {
      "dutyRule": "mfn",
      "partner": null,
      "source": "official",
      "effectiveFrom": "2025-01-01T00:00:00.000Z",
      "suppressedByDeMinimis": true
    },
    "vat": {
      "source": "default",
      "vatBase": "CIF_PLUS_DUTY",
      "effectiveFrom": "2025-01-01T00:00:00.000Z",
      "checkoutCollected": false,
      "suppressedByDeMinimis": false
    },
    "deMinimis": {
      "suppressDuty": true,
      "suppressVAT": false,
      "dutyBasis": "INTRINSIC",
      "vatBasis": null
    },
    "surcharges": {
      "appliedCodes": ["301"],
      "appliedCount": 1,
      "sourceRefs": ["USITC chapter 99"]
    },
    "freight": {
      "model": "card",
      "lookupStatus": "ok",
      "unit": "kg",
      "qty": 2.3
    }
  }
}`}</code>
      </pre>
    </main>
  );
}
