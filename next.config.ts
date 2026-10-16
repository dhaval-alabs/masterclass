import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'masterclass.analytixlabs.co.in',
      },
      {
        protocol: 'https',
        hostname: 'careersuccess.analytixlabs.co.in',
      },
      {
        protocol: 'https',
        hostname: 'www.analytixlabs.co.in',
      },
      {
        protocol: 'https',
        hostname: 'qhgelnkakutzbuvowxzj.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Mirror the in-HTML <meta name="robots"> tag at the HTTP level.
  //
  // The whole subdomain is deliberately kept OUT of Google's organic index
  // (2026-10-14): it's a paid-traffic landing page. `noindex`, not a robots.txt
  // `Disallow: /` — Google must still crawl each page to see the noindex and
  // drop it, so robots.txt keeps `Allow: /`. `follow` so links back to the main
  // site keep passing signal. Ads (Google, Meta) are unaffected by noindex.
  //
  // The catch-all comes FIRST: when several entries set the same header key,
  // the last match wins, so the stricter rules below still apply to their paths.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      },
      {
        source: '/thankyou-for-registration',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
