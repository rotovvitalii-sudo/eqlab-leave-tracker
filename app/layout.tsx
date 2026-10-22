import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "EQLab · Відпустки",
  description: "Облік відпусток і лікарняних EQLab",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-muted/40">{children}</body>
    </html>
  );
}
