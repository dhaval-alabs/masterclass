import { NextRequest, NextResponse } from 'next/server';

const GRAPH_API_VERSION = 'v22.0';

export async function POST(req: NextRequest) {
  let body: { toPhone?: string; templateName?: string; languageCode?: string; variables?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { toPhone, templateName, languageCode = 'en_US', variables = [] } = body;
  if (!toPhone?.trim())       return NextResponse.json({ error: 'toPhone is required' },       { status: 400 });
  if (!templateName?.trim())  return NextResponse.json({ error: 'templateName is required' },  { status: 400 });

  const waAccessToken = process.env.META_WA_ACCESS_TOKEN;
  const waPhoneId     = process.env.META_WA_PHONE_NUMBER_ID;
  if (!waAccessToken || !waPhoneId) {
    return NextResponse.json({ error: 'META_WA_ACCESS_TOKEN or META_WA_PHONE_NUMBER_ID not configured' }, { status: 503 });
  }

  // Replace {name} with "Preview" for test sends.
  const resolvedVars = variables.map(v => v.replace(/\{name\}/gi, 'Preview'));
  const components = resolvedVars.length > 0
    ? [{ type: 'body', parameters: resolvedVars.map(text => ({ type: 'text', text })) }]
    : [];

  // Accept with or without country code.
  const phone = toPhone.trim().replace(/\D/g, '');
  const to = phone.startsWith('91') ? phone : `91${phone}`;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${waAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: { name: templateName.trim(), language: { code: languageCode }, components },
        }),
      },
    );

    if (res.ok) {
      return NextResponse.json({ ok: true, message: `Test sent to +${to}` });
    }

    let detail = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      const err = b?.error;
      if (err) detail = `code=${err.code ?? '?'}: ${err.message ?? 'unknown'}`;
    } catch { /* non-JSON */ }

    return NextResponse.json({ ok: false, error: detail }, { status: 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
