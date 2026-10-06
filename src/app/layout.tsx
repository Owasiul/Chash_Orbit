import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Field Shift — Earth-to-farm decision system",
  description:
    "Field Shift turns NASA Earth-observation data into field-level crop and rotation recommendations. Tell us where your field is, what you grow, and what matters — we analyze NASA POWER, SMAP, GPM and MODIS signals and produce a transparent 4-year rotation plan.",
  keywords: [
    "NASA", "Field Shift", "NASA POWER", "SMAP", "GPM IMERG", "MODIS",
    "crop rotation", "precision agriculture", "Earth observation",
  ],
  authors: [{ name: "Field Shift — NASA Space Apps Challenge" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
  openGraph: {
    title: "Field Shift",
    description: "Earth-to-farm decision system powered by NASA Earth-observation data.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark starfield" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
