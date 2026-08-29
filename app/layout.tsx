import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-print.css";

export const metadata: Metadata = {
  title: "Sales & Cylinder Tracking",
  description: "Mobile-first sales and cylinder tracking for NATIONAL INDUSTRIAL GAS PLANT - OMAN",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-OM">
      <body>{children}</body>
    </html>
  );
}
