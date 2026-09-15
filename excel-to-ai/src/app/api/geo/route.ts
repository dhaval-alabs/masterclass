import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Returns the visitor's approximate city / region / country based on IP.
 *
 * On Vercel, the edge automatically populates these headers — no API key,
 * no external service, no rate limit. Locally (dev) the headers are absent
 * and we return null fields; the client treats that as "no autofill".
 */
export async function GET(req: NextRequest) {
  const headers = req.headers;
  const rawCity = headers.get('x-vercel-ip-city');
  const region = headers.get('x-vercel-ip-country-region');
  const country = headers.get('x-vercel-ip-country');

  // Vercel URL-encodes city names like "New%20Delhi" — decode for display.
  const city = rawCity ? safeDecode(rawCity) : null;

  return NextResponse.json(
    { city, region, country },
    {
      headers: {
        // Cache per-IP for a few minutes at the edge — same visitor, same geo.
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
