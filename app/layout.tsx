import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "./globals-print.css";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, htmlDir, htmlLang, normalizeLocale } from "@/lib/i18n";

const display = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sales & Cylinder Tracking",
  description: "Mobile-first sales and cylinder tracking for NATIONAL INDUSTRIAL GAS PLANT - OMAN",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f766e",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  return (
    <html lang={htmlLang(locale)} dir={htmlDir(locale)} className={`${display.variable} ${body.variable}`}>
      <body>
        <ImpersonationBanner />
        {children}
      </body>
    </html>
  );
}
