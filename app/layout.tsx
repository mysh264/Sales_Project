import type { Metadata } from "next";
import "./globals.css";
import "./globals-print.css";

export const metadata: Metadata = {
  title: "Sales & Cylinder Tracking",
  description: "Mobile-first sales and cylinder tracking for NATIONAL INDUSTRIAL GAS PLANT - OMAN",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
