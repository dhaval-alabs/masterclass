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
                // ── Click ID recovery ────────────────────────────────────
                // Meta only writes _fbc when it sees ?fbclid, and only on that
                // exact landing. Ad clicks that bounce through a redirect, land
                // with the pixel slow to boot, or return in a later session lose
                // it — which is why click id (fbc) sits at ~20% coverage. Rebuild
                // a spec-valid envelope from the fbclid we persist, BEFORE init,
                // so PageView itself carries it. Version digit tracks the click-id
                // FORMAT: encrypted 'PA…' ids are v2, classic fbclids are v1 —
                // stamping a PA id as v1 makes Meta discard it.
                (function(){
                  try {
                    var q = new URLSearchParams(window.location.search);
                    var fbclid = q.get('fbclid') || localStorage.getItem('fbclid');
                    if (!fbclid) return;
                    try {
                      localStorage.setItem('fbclid', fbclid);
                      if (!localStorage.getItem('fbclid_ts')) localStorage.setItem('fbclid_ts', String(Date.now()));
                    } catch (e) {}
                    if (document.cookie.indexOf('_fbc=') !== -1) return; // Meta already set it
                    if (fbclid.indexOf('fb.') === 0) return;             // already an envelope
                    var ts = Number(localStorage.getItem('fbclid_ts')) || Date.now();
                    var ver = fbclid.indexOf('PA') === 0 ? '2' : '1';
                    document.cookie = '_fbc=fb.' + ver + '.' + ts + '.' + fbclid + ';max-age=7776000;path=/;SameSite=Lax';
                  } catch (e) {}
                })();

                // ── Manual Advanced Matching ─────────────────────────────────
                // PageView fires before anyone identifies themselves, so on its
                // own it carries no email/phone/name/city — that is why those sit
                // at 11-38% coverage and cap event match quality. Once someone has
                // registered we know exactly who they are, so replay that identity
                // into init(): every later PageView (reload, return visit, another
                // page) is then matched. Values go in RAW and normalised — the
                // pixel hashes them itself; pre-hashing here would double-hash.
                var __am = {};
                try {
                  var __raw = localStorage.getItem('al_mc_am');
                  if (__raw) {
                    var __d = JSON.parse(__raw);
                    ['em','ph','fn','ln','ct','country'].forEach(function(k){
                      if (__d && typeof __d[k] === 'string' && __d[k]) __am[k] = __d[k];
                    });
                  }
                } catch (e) {}
                fbq('init', '${META_PIXEL_ID}', __am);
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
