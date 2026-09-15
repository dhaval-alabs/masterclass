/**
 * Phase 3 seed — populates the final batch of dynamic columns with the
 * CURRENT live LP content verbatim.
 *
 * Usage: npx tsx scripts/seed-dynamic-phase3.ts
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
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  db: { schema: 'excel_to_ai' },
  auth: { persistSession: false, autoRefreshToken: false },
});

const PHASE3 = {
  // Footer links
  footer_link_1_label: 'Privacy',
  footer_link_1_url: '#',
  footer_link_2_label: 'Terms',
  footer_link_2_url: '#',
  footer_link_3_label: 'Contact',
  footer_link_3_url: '#',
  footer_link_4_label: 'Help',
  footer_link_4_url: '#',

  // Form labels
  form_label_name: 'Full Name',
  form_label_email: 'Email',
  form_label_phone: 'WhatsApp Number',
  form_label_status: 'Status',
  form_label_city: 'City',
  form_label_referral: 'How did you hear about this masterclass?',

  // Form placeholders
  form_placeholder_name: 'Your name',
  form_placeholder_email: 'Email address',
  form_placeholder_phone: '10-digit number',
  form_placeholder_select: 'Select',
  form_placeholder_city: 'City',

  // Select options (newline-separated)
  form_status_options: 'Student\nWorking professional\nCareer switcher',
  form_referral_options: 'Counselor\nSocial Media\nEmail Invite\nWhatsApp Invite\nWord of Mouth',

  // OTP screen
  otp_heading: 'Verify your number',
  otp_subtitle_template: "We've sent a 4-digit code to {phone} via WhatsApp.",
  otp_edit_details_label: 'Edit Details',
  otp_verify_button_text: 'Verify & Complete →',

  // Success screen
  success_heading: "You're Registered!",
  success_body: 'Check your WhatsApp and Email for the Zoom link. We look forward to seeing you there!',

  // Faculty chips — Certificate removed per business decision (not offered).
  // Admin can re-add a third chip via /admin → Webinar tab.
  faculty_chip_1: 'Live Q&A',
  faculty_chip_2: 'Hands-on Lab',
  faculty_chip_3: null,

  // Trusted-by alt
  partnership_image_alt: 'AnalytixLabs alumni placed at Google, Amazon, Deloitte, Accenture and other top companies',
};

async function main() {
  const { error } = await supabase.from('settings').update(PHASE3).eq('id', 'speaker');
  if (error) throw error;
  console.log(`Phase 3 seed: ${Object.keys(PHASE3).length} fields populated`);
  console.log('LP code does not read these yet — page renders identically until Phase 3 code ships.');
}

main().catch(err => { console.error('Seed failed:', err.message || err); process.exit(1); });
