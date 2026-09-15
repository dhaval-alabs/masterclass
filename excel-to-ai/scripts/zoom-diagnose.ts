/**
 * Direct Zoom diagnostic — reads creds from .env.local, gets an OAuth token,
 * and tries to register a test participant. Prints the full response.
 *
 * Run: npx tsx scripts/zoom-diagnose.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function req(name: string) {
  const v = process.env[name];
  if (!v) { console.error('Missing env:', name); process.exit(1); }
  return v;
}

async function getToken() {
  const accountId = req('ZOOM_ACCOUNT_ID');
  const clientId = req('ZOOM_CLIENT_ID');
  const clientSecret = req('ZOOM_CLIENT_SECRET');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  console.log('\n[1/3] OAuth: requesting token...');
  console.log('      account_id =', accountId);
  console.log('      client_id  =', clientId);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    { method: 'POST', headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  const text = await res.text();
  console.log('      status     =', res.status);
  console.log('      body       =', text.slice(0, 400));
  if (!res.ok) { console.error('\n❌ OAuth failed. Stop. Fix ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET first.'); process.exit(1); }
  return JSON.parse(text).access_token as string;
}

async function tryRegister(token: string, label: string, payload: Record<string, string>) {
  const webinarId = req('ZOOM_WEBINAR_ID');
  console.log(`\n[3/3] Register attempt: ${label}`);
  console.log('      webinar_id =', webinarId);
  console.log('      payload    =', JSON.stringify(payload));
  const res = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/registrants`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log('      status     =', res.status);
  console.log('      body       =', text);
  return { ok: res.ok, status: res.status, body: text };
}

async function main() {
  const token = await getToken();

  // Attempt 1: bare minimum (email + first_name only, no phone)
  await tryRegister(token, 'BARE MINIMUM (no phone)', {
    email: `diag-bare-${Date.now()}@scaletrix.ai`,
    first_name: 'DiagBare',
    last_name: 'Test',
  });

  // Attempt 2: with E.164 phone (current code)
  await tryRegister(token, 'WITH +91 PHONE', {
    email: `diag-e164-${Date.now()}@scaletrix.ai`,
    first_name: 'DiagE164',
    last_name: 'Test',
    phone: '+919000000099',
  });

  // Attempt 3: with raw 10-digit phone
  await tryRegister(token, 'WITH RAW 10-DIGIT PHONE', {
    email: `diag-raw-${Date.now()}@scaletrix.ai`,
    first_name: 'DiagRaw',
    last_name: 'Test',
    phone: '9000000099',
  });

  console.log('\n--- done ---');
}

main().catch(e => { console.error('threw:', e); process.exit(1); });
