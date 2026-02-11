export default function MvpSupportDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Current MVP support</h1>
        <p className="text-sm text-muted-foreground">
          This page describes exactly what the MVP quote endpoint currently supports.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Supported today</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>Origins: US, NL</li>
          <li>Destinations: NL, DE</li>
          <li>
            HS chapter 85 only (electronics accessories), including demo HS6 values 850440, 851830,
            852290, 852910
          </li>
          <li>Declared customs value below EUR 150 equivalent</li>
          <li>Mode: air (postal-like parcel shipments)</li>
          <li>Uses official FX, VAT, and duty rows only for the MVP lane</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Not supported yet</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>Any other origins or destinations</li>
          <li>HS chapters outside 85</li>
          <li>Declared value at or above EUR 150 equivalent</li>
          <li>Bulk freight, ocean container flows, or non-air shipping modes</li>
          <li>Formal filing, broker services, or importer-of-record services</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">API behavior</h2>
        <p className="text-sm text-muted-foreground">
          The MVP endpoint fails explicitly when it is outside scope or when required data is stale.
        </p>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>
            <code>unsupported_lane_or_scope</code>
          </li>
          <li>
            <code>above_de_minimis</code>
          </li>
          <li>
            <code>data_not_ready</code>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Disclaimer</h2>
        <p className="text-sm text-muted-foreground">
          This is an estimation tool for planning and pricing. It is not a customs broker and not a
          filing service. Final assessment and charges are determined by customs authorities and
          carriers.
        </p>
      </section>
    </main>
  );
}
