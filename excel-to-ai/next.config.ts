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
  // Mirror the in-HTML <meta name="robots"> tag at the HTTP level. Some SEO
  // auditors (and a few crawlers) check for this header explicitly. We only
  // expose the public LP — admin and APIs are noindex.
  async headers() {
    return [
      {
        source: '/',
        headers: [{ key: 'X-Robots-Tag', value: 'index, follow, max-image-preview:large, max-snippet:-1' }],
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
