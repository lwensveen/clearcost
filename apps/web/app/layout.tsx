import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Clearcost',
  description: 'Landed cost quotes, duties, VAT, and freight.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
