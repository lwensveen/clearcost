import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form } from '@remix-run/react';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get('shop')) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function Index() {
  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'Inter, sans-serif',
        maxWidth: 480,
        margin: '4rem auto',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>ClearCost for Shopify</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Log in to configure your ClearCost integration.
      </p>
      <Form method="post" action="/auth/login">
        <label htmlFor="shop" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Shop domain
        </label>
        <input
          id="shop"
          name="shop"
          type="text"
          placeholder="my-shop.myshopify.com"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: 8,
            fontSize: '1rem',
            marginBottom: '1rem',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 20px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Log in
        </button>
      </Form>
    </div>
  );
}
