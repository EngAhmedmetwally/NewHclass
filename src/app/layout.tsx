
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { SettingsProvider } from '@/hooks/use-settings';
import { SyncProvider } from '@/providers/sync-provider';

export const metadata: Metadata = {
  title: 'Venti',
  description: 'Rental & Sales Management System',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#d5a137" />
        <link rel="icon" href="/icons/icon-192x192.svg" sizes="any" type="image/svg+xml" />
      </head>
      <body
        className={cn(
          'font-body antialiased',
          process.env.NODE_ENV === 'development' ? 'debug-screens' : ''
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
            <FirebaseClientProvider>
              <SettingsProvider>
                <SyncProvider>
                  {children}
                </SyncProvider>
              </SettingsProvider>
            </FirebaseClientProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
