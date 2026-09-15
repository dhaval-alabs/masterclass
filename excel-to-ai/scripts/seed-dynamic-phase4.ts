/**
 * Phase 4 seed — populates ThankYouPage dynamic columns with current verbatim content.
 *
 * Usage: npx tsx scripts/seed-dynamic-phase4.ts
 * Idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }

const supabase = createClient(url, key, {
  db: { schema: 'excel_to_ai' },
  auth: { persistSession: false, autoRefreshToken: false },
});

const PHASE4 = {
  thankyou_heading: "You're Registered!",
  thankyou_subcopy: "Your spot for the upcoming masterclass is confirmed. Check your email for joining details.",
  thankyou_confirmation_template: "Confirmation sent to: {email}",

  thankyou_webinar_title_personal: "Your Webinar Access",
  thankyou_webinar_title_default:  "Upcoming Webinar",
  thankyou_webinar_body_personal:  "You're confirmed. Click below to join your masterclass when it begins — no extra signup needed.",
  thankyou_webinar_body_default:   "Expert guidance on building a career in Data Science. Free access.",
  thankyou_webinar_cta_personal:   "Join Webinar →",
  thankyou_webinar_cta_default:    "Save My Spot →",

  thankyou_phone_title: "Need Help? Talk to Us",
  thankyou_phone_body:  "Advisors available Mon–Sat, 9 AM to 7 PM.",
  thankyou_phone_cta:   "Call 95555 25908",
  thankyou_phone_number: "919555525908",

  thankyou_whatsapp_title:   "Chat on WhatsApp",
  thankyou_whatsapp_body:    "Connect with our counsellor instantly on WhatsApp.",
  thankyou_whatsapp_cta:     "Chat Now",
  thankyou_whatsapp_number:  "919555525908",
  thankyou_whatsapp_message: "Hello, I just submitted my details on the AnalytixLabs website. Can you help me?",

  thankyou_footer_text: "© {YEAR} AnalytixLabs. All rights reserved. | NASSCOM-FutureSkills Prime Accredited.",

  generic_brochure_url: "https://www.analytixlabs.co.in/pdf/Nasscom_(ACDS)_Advanced_Certification_in_Data_Science_Alabs280126.pdf",
  generic_brochure_cta: "Download File now",
};

async function main() {
  const { error } = await supabase.from('settings').update(PHASE4).eq('id', 'speaker');
  if (error) throw error;
  console.log(`Phase 4 seed: ${Object.keys(PHASE4).length} fields populated`);
}

main().catch(err => { console.error('Seed failed:', err.message || err); process.exit(1); });
