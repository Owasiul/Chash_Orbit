import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LanguageSwitcher from "@/components/language-switcher";
import { Toaster } from "@/components/ui/toaster";
import { LocaleProvider } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale-server";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const isBangla = locale === 'bn-BD';
  const title = isBangla
    ? 'চাষ অরবিট — পৃথিবী থেকে খামারের সিদ্ধান্ত ব্যবস্থা'
    : 'Chash Orbit — Earth to farm decision system';
  const description = isBangla
    ? 'চাষ অরবিট NASA-র পৃথিবী পর্যবেক্ষণ তথ্য থেকে ক্ষেতভিত্তিক ফসল ও পর্যায়ক্রমের সুপারিশ তৈরি করে। আপনার ক্ষেতের জন্য স্বচ্ছ চার বছরের পরিকল্পনা পান।'
    : 'Chash Orbit turns NASA Earth-observation data into field-level crop and rotation recommendations. Explore a transparent four-year plan for your field.';
  const openGraphDescription = isBangla
    ? 'NASA-র পৃথিবী পর্যবেক্ষণ তথ্যনির্ভর ক্ষেত থেকে খামারের সিদ্ধান্ত ব্যবস্থা।'
    : 'Earth-to-farm decision system powered by NASA Earth-observation data.';

  return {
    title,
    description,
    keywords: isBangla
      ? ['NASA', 'চাষ অরবিট', 'ফসল পর্যায়ক্রম', 'কৃষি', 'পৃথিবী পর্যবেক্ষণ']
      : ['NASA', 'Chash Orbit', 'crop rotation', 'precision agriculture', 'Earth observation'],
    authors: [{ name: 'Chash Orbit — NASA Space Apps Challenge' }],
    icons: { icon: './Logo.svg' },
    openGraph: {
      title: isBangla ? 'চাষ অরবিট' : 'Chash Orbit',
      description: openGraphDescription,
      locale: isBangla ? 'bn_BD' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description: openGraphDescription,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} dir="ltr" className="dark starfield" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <LocaleProvider initialLocale={locale}>
          {children}
          <LanguageSwitcher />
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
