import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Drummer's Precision Metronome | Professional Click Track Generator",
  description:
    "Advanced metronome and click track generator designed specifically for drummers. Improve your timing, practice complex rhythms, and perfect your beats with our professional-grade tool.",
  keywords:
    "drummer metronome, click track generator, drum practice tool, rhythm trainer, beat precision, tempo practice",
  openGraph: {
    title: "Drummer's Precision Metronome",
    description: "Professional click track generator for drummers",
    url: "https://click-track-generator.vercel.app/",
    siteName: "Drummer's Precision Metronome",
    images: [
      {
        url: "https://click-track-generator.vercel.app/images/og.webp",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Drummer's Precision Metronome",
    description: "Professional click track generator for drummers",
    images: ["https://click-track-generator.vercel.app/images/og.webp"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Drummer's Precision Metronome",
  operatingSystem: "Any",
  applicationCategory: "UtilitiesApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Advanced metronome and click track generator designed specifically for drummers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
