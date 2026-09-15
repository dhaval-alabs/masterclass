/**
 * Seeds the new dynamic columns + tables with the CURRENT live LP content,
 * verbatim. After running, the LP renders identically — only when an admin
 * edits a value does anything visible change.
 *
 * Usage: npx tsx scripts/seed-dynamic.ts
 *
 * Idempotent — re-running is safe.
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

// ─── EXACT current LP content ────────────────────────────────────────────────
// Every string here is copy-pasted from src/app/page.tsx as it renders today.
// Edit ONLY in the admin panel after this seed runs — never edit here.

const SETTINGS = {
  webinar_title: "From Excel to AI — Inside the Data Analyst & Data Scientist Workflow",
  webinar_subtitle: 'Master the high-demand stack of Excel, SQL, Python, and Power BI with AI integration. Learn from the "og" mentors at AnalytixLabs.',
  eyebrow_text: "🚀 Free 90-Minute Live Masterclass • Beginner Friendly",
  webinar_date_label: "Sat, 6 June 2026",
  webinar_time_label: "7:00 PM IST",
  webinar_datetime_utc: "2026-06-06T13:30:00+00:00",
  duration_label: "90 Min",
  meta_title: "From Excel to AI — Inside the Data Analyst & Data Scientist Workflow",
  meta_description: "Join our free 90-minute live session to learn how data analysts and scientists use Python and AI in 2026. Beginner-safe.",
  og_image_url: null,
  form_heading: "Register for the Free Masterclass",
  form_subheading: "Join 15,000+ learners discovering AI-powered analytics workflows.",
  sticky_eyebrow: "Sat, 6 June 2026 · 7:00 PM IST · Live Online",
  sticky_main: "Limited free seats — reserve yours before registrations close.",
  cta_button_text: "Register Now",
  nav_cta_text: "Book Free Session",
  logo_path: "/brand/ALabs_Masterclass.svg",
  zoom_webinar_id: "82257523823",
  lsq_source_name: "PPC-SM",
  whatsapp_template_name: "form_otp",
  hero_stat_1_value: "50K+",
  hero_stat_1_label: "Students Trained",
  hero_stat_2_value: "4.9★",
  hero_stat_2_label: "Average Rating",
  hero_stat_3_value: "100%",
  hero_stat_3_label: "Live Training",
  show_definition_section: true,
  definition_section_title: "Data Analyst vs Data Scientist — what's the difference?",
  definition_intro: "A Data Analyst focuses on querying, visualizing, and reporting on existing data using Excel, SQL, and BI tools like Power BI or Tableau. A Data Scientist extends this work with statistical modeling and machine learning in Python to make predictions about future outcomes. In 2026, both roles increasingly use AI co-pilots to accelerate their work.",
  definition_a_title: "Data Analyst",
  definition_a_body: "Excel, SQL, Power BI / Tableau, Python (basics)\nDescribes the past — dashboards, KPIs, reports\nTypical India salary: ₹4–8 LPA (entry), ₹10–18 LPA (3–5 yrs)\nFoundation skill: SQL fluency + clear data storytelling",
  definition_b_title: "Data Scientist",
  definition_b_body: "Python, ML libraries, statistics, SQL, MLOps basics\nPredicts the future — models, forecasts, recommendations\nTypical India salary: ₹6–12 LPA (entry), ₹14–25 LPA (3–5 yrs)\nFoundation skill: Python + statistical reasoning + ML fundamentals",
  agenda_section_title: "From Excel to AI — Inside the Data Analyst & Data Scientist Workflow in 2026",
  agenda_section_subtitle: "One business question. One dataset. Four tools in increasing order of leverage — Excel, SQL, Python, and AI. Watch the fork between the analyst and scientist roles unfold in real time.",
  faculty_intro: "Live Session",
  footer_text: "© {YEAR} AnalytixLabs India. Global Headquarters: Gurgaon, India.",
};

const FEATURES = [
  {
    id: "feat-ai-analytics",
    icon: "✦",
    title: "AI-Powered Analytics",
    description: "Use ChatGPT, Claude, and automation workflows to generate insights 10x faster.",
    accent: "gold",
    sort_order: 0,
  },
  {
    id: "feat-modern-toolkit",
    icon: "⚒",
    title: "The Modern Toolkit",
    description: "Master the high-ROI intersection of Excel, SQL, Python, and Power BI dashboards.",
    accent: null,
    sort_order: 1,
  },
  {
    id: "feat-career-roadmap",
    icon: "🚀",
    title: "Career Roadmap",
    description: "Strategic path to transition into Data Analyst and Data Science roles in 2026.",
    accent: null,
    sort_order: 2,
  },
];

const AGENDA = [
  {
    id: "agenda-1",
    title: "The 2026 Data Career Landscape",
    description: 'Why "data" isn\'t just one job anymore. The split between Data Analyst and Data Scientist paths, new hiring trends, and how GenAI is widening this gap.',
    highlight: false,
    sort_order: 0,
  },
  {
    id: "agenda-2",
    title: "Excel as Foundation",
    description: "Why Excel is still the starting point — and the three signals that you've outgrown it.",
    highlight: false,
    sort_order: 1,
  },
  {
    id: "agenda-3",
    title: "SQL as the Analyst's Core",
    description: "The SQL constructs that cover 80% of real analyst work, and how they connect to BI tools like Power BI and Tableau.",
    highlight: false,
    sort_order: 2,
  },
  {
    id: "agenda-4",
    title: "Python as the Bridge",
    description: "Moving from describing data to predicting it. This is where the analyst path extends into data science.",
    highlight: false,
    sort_order: 3,
  },
  {
    id: "agenda-5",
    title: "AI and GenAI in the Workflow",
    description: 'Using AI as a co-pilot for SQL and Python. What "AI-fluent" actually means on a resume today.',
    highlight: false,
    sort_order: 4,
  },
  {
    id: "agenda-6",
    title: "The Fork: Analyst vs. Scientist",
    description: "A direct comparison of salary bands, tools, and daily life — including a six-month roadmap for each.",
    highlight: false,
    sort_order: 5,
  },
  {
    id: "agenda-7",
    title: "Live Q&A",
    description: "Your specific career questions, answered live — bring your background and we'll map your next steps.",
    highlight: false,
    sort_order: 6,
  },
  {
    id: "agenda-8",
    title: "Program Walkthrough",
    description: "Introduction to our Data Analytics with AI and Full Stack AI / Data Science tracks. Outcome-backed results: ₹6L minimum CTC, with a 50% refund policy if not placed within six months.",
    highlight: true,
    sort_order: 7,
  },
];

async function main() {
  // 1. settings — update the singleton row, only the new columns
  const { error: setErr } = await supabase
    .from('settings')
    .update(SETTINGS)
    .eq('id', 'speaker');
  if (setErr) throw setErr;
  console.log(`settings: ${Object.keys(SETTINGS).length} new fields populated`);

  // 2. features
  const { error: featErr } = await supabase
    .from('features')
    .upsert(FEATURES, { onConflict: 'id' });
  if (featErr) throw featErr;
  console.log(`features: upserted ${FEATURES.length}`);

  // 3. agenda_items
  const { error: agErr } = await supabase
    .from('agenda_items')
    .upsert(AGENDA, { onConflict: 'id' });
  if (agErr) throw agErr;
  console.log(`agenda_items: upserted ${AGENDA.length}`);

  console.log('Seed complete. The LP code does not read these yet — page renders identically until Phase 1b ships.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
