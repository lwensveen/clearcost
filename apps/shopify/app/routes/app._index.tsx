import { json } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { useCallback, useState } from 'react';

import prisma from '~/db.server';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  return json({
    shop: session.shop,
    apiKey: settings?.apiKey ?? '',
    originCountry: settings?.originCountry ?? 'US',
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const apiKey = (formData.get('apiKey') as string) ?? '';
  const originCountry = (formData.get('originCountry') as string) ?? 'US';

  await prisma.shopSettings.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop, apiKey, originCountry },
    update: { apiKey, originCountry },
  });

  return json({ status: 'saved' as const });
};

const COUNTRIES = [
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'Canada', value: 'CA' },
  { label: 'Australia', value: 'AU' },
  { label: 'Germany', value: 'DE' },
  { label: 'France', value: 'FR' },
  { label: 'Netherlands', value: 'NL' },
  { label: 'China', value: 'CN' },
  { label: 'Japan', value: 'JP' },
  { label: 'India', value: 'IN' },
  { label: 'Mexico', value: 'MX' },
  { label: 'Brazil', value: 'BR' },
  { label: 'Italy', value: 'IT' },
  { label: 'Spain', value: 'ES' },
  { label: 'South Korea', value: 'KR' },
  { label: 'Turkey', value: 'TR' },
  { label: 'Vietnam', value: 'VN' },
  { label: 'Thailand', value: 'TH' },
  { label: 'Poland', value: 'PL' },
  { label: 'Belgium', value: 'BE' },
];

export default function Settings() {
  const { shop, apiKey: savedKey, originCountry: savedOrigin } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const [apiKey, setApiKey] = useState(savedKey);
  const [originCountry, setOriginCountry] = useState(savedOrigin);

  const isSaving = navigation.state === 'submitting';

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set('apiKey', apiKey);
    formData.set('originCountry', originCountry);
    submit(formData, { method: 'post' });
  }, [apiKey, originCountry, submit]);

  return (
    <Page title="ClearCost Settings">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {actionData?.status === 'saved' && (
              <Banner title="Settings saved" tone="success" onDismiss={() => {}} />
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Connection
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Enter your ClearCost API key to enable duty and tax calculations at checkout. You
                  can find your key in the{' '}
                  <a href="https://clearcost.dev/dashboard" target="_blank" rel="noreferrer">
                    ClearCost dashboard
                  </a>
                  .
                </Text>
                <TextField
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                  type="password"
                  autoComplete="off"
                  helpText="Your secret API key (sk_live_…)"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Shipping origin
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  The country your products ship from. This is used as the origin for duty
                  calculations.
                </Text>
                <Select
                  label="Origin country"
                  options={COUNTRIES}
                  value={originCountry}
                  onChange={setOriginCountry}
                />
              </BlockStack>
            </Card>

            <InlineStack align="end">
              <Button variant="primary" onClick={handleSave} loading={isSaving}>
                Save
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                About
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Connected store: <strong>{shop}</strong>
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                ClearCost calculates landed costs — duties, taxes, and fees — and shows them to your
                customers before checkout so there are no surprises at delivery.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
