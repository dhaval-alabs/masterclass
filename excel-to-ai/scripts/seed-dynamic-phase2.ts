/**
 * Seeds the Phase 2 columns with the CURRENT live LP content verbatim.
 * After running, the LP renders identically — only when an admin edits a
 * value does anything visible change.
 *
 * Usage: npx tsx scripts/seed-dynamic-phase2.ts
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

// ─── EXACT current LP content, verbatim ─────────────────────────────────────
// Markup convention for the H1 + section titles:
//   *xxx*  → green-accent span (text-[#00DF83])
//   **xxx**→ strong / bold
// Plain newlines in bullet-list bodies are rendered as <li> on the page.

const PHASE2 = {
  // Hero
  hero_eyebrow_pill: '🚀 Free 90-Minute Live Masterclass • Beginner Friendly',
  hero_h1_markup: 'From *Excel to AI* —\nInside the Data Analyst & Data Scientist *Workflow*',
  hero_subtitle: 'Master the high-demand stack of Excel, SQL, Python, and Power BI with AI integration. Learn from the "og" mentors at AnalytixLabs.',
  countdown_label: 'Registrations close in',
  urgency_badge_text: 'Filling Fast',
  save_spot_cta_text: 'Save My Spot for the Live Session',

  // Form card
  form_pill_date_label: 'Sat, 6 June · 7:00 PM IST',
  form_pill_seats_label: 'Limited Seats',
  form_otp_footer_label: 'INSTANT OTP VIA WHATSAPP',
  form_bottom_stat_1_value: '4.9/5',
  form_bottom_stat_1_label: 'Reviews',
  form_bottom_stat_2_value: '50,000+',
  form_bottom_stat_2_label: 'Alumni',
  form_bottom_stat_3_value: '90 Min',
  form_bottom_stat_3_label: 'Live Session',
  stats_disclaimer: 'Stats as of Q1 2026, per AnalytixLabs internal enrollment data.',
  partnership_caption: 'In Partnership With',
  partnership_image_path: '/brand/Final_logo.png',

  // Definition section
  definition_eyebrow: 'Quick Primer',
  definition_a_bullets: 'Excel, SQL, Power BI / Tableau, Python (basics)\nDescribes the past — dashboards, KPIs, reports\nTypical India salary: ₹4–8 LPA (entry), ₹10–18 LPA (3–5 yrs)\nFoundation skill: SQL fluency + clear data storytelling',
  definition_b_bullets: 'Python, ML libraries, statistics, SQL, MLOps basics\nPredicts the future — models, forecasts, recommendations\nTypical India salary: ₹6–12 LPA (entry), ₹14–25 LPA (3–5 yrs)\nFoundation skill: Python + statistical reasoning + ML fundamentals',

  // Features section
  features_section_title: "What You'll *Master*",
  features_section_subtitle: 'Designed for beginners and professionals who want to build modern AI-powered analytics skills in record time.',
  features_image_path: '/brand/landingpageelement.png',

  // Inside the Session
  session_inside_pill: 'Inside the Session',
  session_badge_1: '90 minutes',
  session_badge_2: 'Live on Zoom Webinar',
  session_badge_3: 'Freshers & working professionals',
  session_obj_eyebrow: 'By the end of this session',
  session_obj_title: 'You will clearly understand',
  session_obj_1_num: '01',
  session_obj_1_title: 'What the work actually looks like',
  session_obj_1_desc: 'The day-to-day reality of an analyst and a data scientist in 2026 — tools, tasks, and the questions they answer.',
  session_obj_2_num: '02',
  session_obj_2_title: 'Which path fits you best',
  session_obj_2_desc: 'A clear, six-month roadmap tailored to your background, so you leave with a specific plan — not just inspiration.',
  session_walkthrough_eyebrow: "What we'll cover",
  session_walkthrough_title: 'The 90-minute walkthrough',

  // Faculty
  faculty_heading_prefix: 'Learn from',

  // FAQ
  faq_section_title: 'Common Questions',

  // Also overwrite the agenda/definition section titles to use markup so the
  // green span renders correctly when the page reads from DB.
  agenda_section_title: 'From Excel to AI — Inside the Data Analyst & *Data Scientist* Workflow in 2026',
  definition_section_title: "Data Analyst vs Data Scientist — what's the difference?",
  // Definition intro keeps **bold** markup for "Data Analyst" / "Data Scientist"
  definition_intro: 'A **Data Analyst** focuses on querying, visualizing, and reporting on existing data using Excel, SQL, and BI tools like Power BI or Tableau. A **Data Scientist** extends this work with statistical modeling and machine learning in Python to make predictions about future outcomes. In 2026, both roles increasingly use AI co-pilots to accelerate their work.',
};

async function main() {
  const { error } = await supabase.from('settings').update(PHASE2).eq('id', 'speaker');
  if (error) throw error;
  console.log(`Phase 2 seed: ${Object.keys(PHASE2).length} fields populated`);
  console.log('LP code does not read these yet — page renders identically until Phase 2 code ships.');
}

main().catch(err => { console.error('Seed failed:', err.message || err); process.exit(1); });
