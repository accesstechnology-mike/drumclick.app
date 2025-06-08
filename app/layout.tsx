import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "DrumClick.app | Click Tracks for Drummers",
  description:
    "Advanced metronome and click track generator designed specifically for drummers. Improve your timing, practice complex rhythms, and perfect your beats with our professional-grade tool.",
  keywords:
    "drummer metronome, click track generator, drum practice tool, rhythm trainer, beat precision, tempo practice",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DrumClick",
  },
  openGraph: {
    title: "DrumClick.app",
    description: "Professional click track generator for drummers",
    url: "https://drumclick.app/",
    siteName: "DrumClick.app",
    images: [
      {
        url: "https://drumclick.app/images/og.webp",
        width: 1200,
        height: 630,
        alt: "DrumClick.app - Professional Click Track Generator for Drummers",
      },
      {
        url: "https://drumclick.app/images/og.png",
        width: 1200,
        height: 630,
        alt: "DrumClick.app - Professional Click Track Generator for Drummers",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DrumClick.app",
    description: "Professional click track generator for drummers",
    images: ["https://drumclick.app/images/og.webp"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "DrumClick.app",
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DrumClick" />
        
        {/* Favicon links */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="256x256" href="/favicon-256x256.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Script
          id="service-worker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('Service Worker registered with scope:', registration.scope);
                      
                      // Periodically send keep-alive messages to the service worker
                      setInterval(() => {
                        if (registration.active) {
                          registration.active.postMessage({ type: 'KEEP_ALIVE' });
                        }
                      }, 25000);
                    })
                    .catch(function(error) {
                      console.log('Service Worker registration failed:', error);
                    });
                });
              }
              
              // Request wake lock when audio is playing
              let wakeLock = null;
              
              async function requestWakeLock() {
                try {
                  if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock is active');
                    
                    wakeLock.addEventListener('release', () => {
                      console.log('Wake Lock was released');
                    });
                  } else {
                    console.log('Wake Lock API not supported');
                  }
                } catch (err) {
                  console.error('Wake Lock request failed:', err);
                }
              }
              
              // Release wake lock when visibility changes
              document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                  await requestWakeLock();
                }
              });
              
              // Listen for audio playback to request wake lock
              document.addEventListener('DOMContentLoaded', () => {
                // Create a MutationObserver to detect when audio elements are added to the DOM
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    if (mutation.addedNodes) {
                      mutation.addedNodes.forEach((node) => {
                        // Check if the added node is an audio element or contains audio elements
                        if (node.nodeName === 'AUDIO' || (node.querySelectorAll && node.querySelectorAll('audio').length > 0)) {
                          const audioElements = node.nodeName === 'AUDIO' ? [node] : node.querySelectorAll('audio');
                          
                          audioElements.forEach((audio) => {
                            audio.addEventListener('play', async () => {
                              await requestWakeLock();
                            });
                            
                            audio.addEventListener('pause', () => {
                              if (wakeLock) {
                                wakeLock.release();
                                wakeLock = null;
                              }
                            });
                          });
                        }
                      });
                    }
                  });
                });
                
                // Start observing the document with the configured parameters
                observer.observe(document.body, { childList: true, subtree: true });
              });
            `,
          }}
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
