import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { getWebinarConfig } from "@/lib/db";

const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://masterclass.analytixlabs.co.in';
const FALLBACK_TITLE = "From Excel to AI — Inside the Data Analyst & Data Scientist Workflow";
const FALLBACK_DESCRIPTION = "Join our free 90-minute live session to learn how data analysts and scientists use Python and AI in 2026. Beginner-safe.";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export async function generateMetadata(): Promise<Metadata> {
  // Read editable meta tags from the webinar config; fall back to the values
  // the LP shipped with so unset/null fields render identically to the
  // previous static metadata.
  const config = await getWebinarConfig().catch(() => null);
  const title = config?.metaTitle ?? FALLBACK_TITLE;
  const description = config?.metaDescription ?? FALLBACK_DESCRIPTION;
  const ogImage = config?.ogImageUrl ?? undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      type: 'website',
      url: SITE_URL,
      title,
      description,
      siteName: 'AnalytixLabs',
      locale: 'en_IN',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        {/* Initialize GTM dataLayer early so any GTM/Stape script loaded
            later (or any pixel-fire push from the form) can rely on it
            existing. Idempotent — safe even if GTM later redefines it. */}
        <Script
          id="dl-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: 'window.dataLayer = window.dataLayer || [];' }}
        />
        {/* Google Analytics 4 — only render when a measurement ID is configured */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', { page_path: window.location.pathname });
                `,
              }}
            />
          </>
        )}
        {/* Meta Pixel Code — only render when a real Pixel ID is configured */}
        {META_PIXEL_ID && (
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${META_PIXEL_ID}');
                fbq('track', 'PageView');
              `,
            }}
          />
        )}
      </head>
      <body className="font-poppins antialiased min-h-screen bg-white text-[#003368]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
