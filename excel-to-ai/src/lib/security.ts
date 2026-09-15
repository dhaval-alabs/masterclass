export function assertSameOrigin(req: Request): { ok: true } | { ok: false; reason: string } {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (!host) return { ok: false, reason: 'Missing host header' };

  const expectedHosts = new Set<string>([host]);
  const extra = process.env.ALLOWED_ORIGINS;
  if (extra) {
    for (const raw of extra.split(',').map(s => s.trim()).filter(Boolean)) {
      try {
        expectedHosts.add(new URL(raw).host);
      } catch {
        expectedHosts.add(raw);
      }
    }
  }

  const candidate = origin ?? referer;
  if (!candidate) return { ok: false, reason: 'Missing Origin and Referer headers' };

  let candidateHost: string;
  try {
    candidateHost = new URL(candidate).host;
  } catch {
    return { ok: false, reason: 'Malformed Origin/Referer header' };
  }

  if (!expectedHosts.has(candidateHost)) {
    return { ok: false, reason: `Origin ${candidateHost} not allowed` };
  }
  return { ok: true };
}
