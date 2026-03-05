import { json } from '@remix-run/node';
import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/node';
import { Link, Outlet, useLoaderData, useRouteError } from '@remix-run/react';
import { NavMenu } from '@shopify/app-bridge-react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url';

import { authenticate } from '~/shopify.server';

export const links = () => [{ rel: 'stylesheet', href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || '' });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={enTranslations}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app">Settings</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return <BoundaryContent />;
}

function BoundaryContent() {
  const error = useRouteError();

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
      <h1>Something went wrong</h1>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#721c24' }}>
        {error instanceof Error ? error.message : JSON.stringify(error)}
      </pre>
    </div>
  );
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
  return loaderHeaders;
};
