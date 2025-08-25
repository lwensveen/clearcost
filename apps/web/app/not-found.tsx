import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-600">The page you are looking for doesn’t exist.</p>
        <div className="mt-4">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
