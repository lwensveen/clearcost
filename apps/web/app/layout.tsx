import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/provider';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const fontHeading = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-heading',
});

const fontBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Clearcost',
  description: 'Landed cost quotes, duties, VAT, and freight.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable} min-h-screen bg-white text-slate-900`}
      >
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
