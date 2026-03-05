import { useState, useEffect } from 'react';
import {
  reactExtension,
  useShippingAddress,
  useCartLines,
  useAppMetafields,
  useLocalizationCountry,
  Banner,
  BlockStack,
  InlineLayout,
  Text,
  Divider,
  SkeletonText,
} from '@shopify/ui-extensions-react/checkout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuoteBody = {
  origin: string;
  dest: string;
  itemValue: { amount: number; currency: string };
  dimsCm: { l: number; w: number; h: number };
  weightKg: number;
  categoryKey: string;
  hs6?: string;
  mode: 'air' | 'sea';
};

type QuoteResponse = {
  total: number;
  components: {
    CIF: number;
    duty: number;
    vat: number;
    fees: number;
    checkoutVAT?: number;
  };
  incoterm?: string;
  currency?: string;
  overallConfidence?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DIMS = { l: 20, w: 15, h: 10 };
const DEFAULT_WEIGHT = 1.0;
const DEFAULT_MODE = 'air' as const;

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default reactExtension('purchase.checkout.delivery-address.render-after', () => (
  <LandedCostEstimate />
));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LandedCostEstimate() {
  const shippingAddress = useShippingAddress();
  const cartLines = useCartLines();
  const country = useLocalizationCountry();

  // Read merchant-configured metafields
  const originMeta = useAppMetafields({ key: 'clearcost_origin', namespace: 'custom' });
  const hs6Meta = useAppMetafields({ key: 'clearcost_hs6', namespace: 'custom' });
  const weightMeta = useAppMetafields({ key: 'clearcost_weight_kg', namespace: 'custom' });
  const dimsMeta = useAppMetafields({ key: 'clearcost_dims_cm', namespace: 'custom' });
  const categoryMeta = useAppMetafields({ key: 'clearcost_category', namespace: 'custom' });

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destCountry = shippingAddress?.countryCode;
  const shopCountry = country?.isoCode;

  // Determine origin: metafield → shop country → fallback
  const originCountry = originMeta?.[0]?.metafield?.value ?? shopCountry ?? 'US';

  // Build quote body from cart and metafields
  const totalAmount = cartLines.reduce((sum, line) => {
    const price = line.cost?.totalAmount?.amount;
    return sum + (price ? Number(price) : 0);
  }, 0);

  const currencyCode = cartLines[0]?.cost?.totalAmount?.currencyCode ?? 'USD';

  // Parse product metafields (use first product's values or defaults)
  const hs6 = hs6Meta?.[0]?.metafield?.value ?? undefined;
  const weightKg = weightMeta?.[0]?.metafield?.value
    ? Number(weightMeta[0].metafield.value)
    : DEFAULT_WEIGHT;

  let dimsCm = DEFAULT_DIMS;
  try {
    const raw = dimsMeta?.[0]?.metafield?.value;
    if (raw) dimsCm = JSON.parse(raw);
  } catch {
    // use defaults
  }

  const categoryKey = categoryMeta?.[0]?.metafield?.value ?? 'general';

  useEffect(() => {
    if (!destCountry || !totalAmount) return;

    // Don't quote domestic shipments
    if (destCountry === originCountry) return;

    const body: QuoteBody = {
      origin: originCountry,
      dest: destCountry,
      itemValue: { amount: totalAmount, currency: currencyCode },
      dimsCm,
      weightKg,
      categoryKey,
      hs6,
      mode: DEFAULT_MODE,
    };

    let cancelled = false;

    async function fetchQuote() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/apps/clearcost/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (cancelled) return;

        if (!res.ok) {
          const text = await res.text();
          // Don't show errors for unsupported lanes — just hide
          if (res.status === 422) {
            setQuote(null);
            return;
          }
          throw new Error(text || `HTTP ${res.status}`);
        }

        const data: QuoteResponse = await res.json();
        if (!cancelled) setQuote(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Unable to estimate duties');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [destCountry, originCountry, totalAmount, currencyCode, hs6, weightKg, categoryKey]);

  // Don't render for domestic shipments
  if (!destCountry || destCountry === originCountry) return null;

  // Loading state
  if (loading && !quote) {
    return (
      <Banner title="Estimating import duties & taxes…">
        <BlockStack spacing="extraTight">
          <SkeletonText />
          <SkeletonText />
        </BlockStack>
      </Banner>
    );
  }

  // Error state — non-blocking, just show info
  if (error) {
    return (
      <Banner title="Import duties & taxes" status="warning">
        <Text>Unable to estimate landed costs for this destination.</Text>
      </Banner>
    );
  }

  // No quote available (unsupported lane)
  if (!quote) return null;

  // Render breakdown
  const fmt = (amount: number) => {
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: quote.currency ?? currencyCode,
      }).format(amount);
    } catch {
      return `${quote.currency ?? currencyCode} ${amount.toFixed(2)}`;
    }
  };

  return (
    <Banner title="Estimated import duties & taxes">
      <BlockStack spacing="tight">
        <CostRow label="Duty" amount={fmt(quote.components.duty)} />
        <CostRow label="VAT / Tax" amount={fmt(quote.components.vat)} />
        {quote.components.checkoutVAT !== undefined && (
          <CostRow label="Checkout VAT (IOSS)" amount={fmt(quote.components.checkoutVAT)} />
        )}
        <CostRow label="Fees" amount={fmt(quote.components.fees)} />

        <Divider />

        <InlineLayout columns={['fill', 'auto']}>
          <Text emphasis="bold">Total landed cost</Text>
          <Text emphasis="bold">{fmt(quote.total)}</Text>
        </InlineLayout>

        {quote.incoterm && (
          <Text appearance="subdued" size="small">
            Incoterm: {quote.incoterm}
          </Text>
        )}
      </BlockStack>
    </Banner>
  );
}

function CostRow({ label, amount }: { label: string; amount: string }) {
  return (
    <InlineLayout columns={['fill', 'auto']}>
      <Text appearance="subdued">{label}</Text>
      <Text>{amount}</Text>
    </InlineLayout>
  );
}
