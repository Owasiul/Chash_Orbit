import { FarmProvider } from '@/lib/FarmContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <FarmProvider>{children}</FarmProvider>
      </body>
    </html>
  );
}