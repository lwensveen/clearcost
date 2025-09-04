import { notFound } from 'next/navigation';

export default async function ReplayQuote({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!key) notFound();

  const r = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/clearcost/quotes/by-key?key=${encodeURIComponent(key)}`,
    {
      cache: 'no-store',
    }
  );
  const text = await r.text();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Replay: {key}</h1>
      <pre className="rounded bg-gray-50 p-4 text-xs whitespace-pre-wrap">{text}</pre>
    </div>
  );
}
