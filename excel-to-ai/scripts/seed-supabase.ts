/**
 * Seeds excel_to_ai.settings / registrations / faqs from data/db.json
 * via the Supabase JS client (service-role key, bypasses RLS).
 *
 * Usage: npx tsx scripts/seed-supabase.ts
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

type Registration = { id?: string; fullName: string; email: string; phone: string; status: string; city: string; createdAt?: string };
type Faq = { id: string; q: string; a: string; order: number };
type DbSchema = {
  settings: { speakerName: string; speakerTitle: string; speakerImage: string; speakerBio: string };
  registrations: Registration[];
  faqs?: Faq[];
};

// Fallback FAQs — mirrors DEFAULT_FAQS in src/lib/db.ts, used when db.json
// doesn't carry an explicit faqs array.
const DEFAULT_FAQS: Faq[] = [
  { id: 'seed-1', q: 'Is this really free?', a: 'Yes, this is a community-first session with no hidden costs or upsells.', order: 0 },
  { id: 'seed-2', q: 'Do I need coding experience?', a: 'None required. We start from Excel basics and move into AI tools.', order: 1 },
  { id: 'seed-3', q: 'Will I get a recording?', a: 'Live attendance is encouraged, but a 48-hour recording link is shared.', order: 2 },
  { id: 'seed-4', q: 'Is there a certificate?', a: 'Yes, all live attendees get a Masterclass Completion certificate.', order: 3 },
  { id: 'seed-5', q: 'What is the difference between a Data Analyst and a Data Scientist?', a: 'A Data Analyst focuses on querying, visualizing, and reporting on existing data using Excel, SQL, and BI tools like Power BI or Tableau. A Data Scientist extends this work with statistical modeling and machine learning in Python to make predictions about future outcomes. In 2026, both roles increasingly use AI co-pilots to speed up analysis.', order: 4 },
  { id: 'seed-6', q: 'How long does it take to become a Data Analyst in 2026?', a: 'A focused 4 to 6-month plan covering Excel, SQL, Power BI, and Python fundamentals is enough to land an entry-level Data Analyst role. Mastery and senior roles typically take 1 to 2 years of consistent project work.', order: 5 },
  { id: 'seed-7', q: 'What salary can a Data Analyst expect in India in 2026?', a: 'Entry-level Data Analyst salaries in India typically range from ₹4-8 LPA. Mid-level (3-5 years) ranges ₹10-18 LPA, and Data Scientists at the same experience earn 20-40% more on average. Our placement track records a ₹6L minimum CTC for graduates.', order: 6 },
  { id: 'seed-8', q: 'Is Python required for data analysis?', a: 'Python is not required to start, but it becomes important once you outgrow Excel and SQL — particularly for automation, statistical analysis, and predictive modeling. Data Scientists need Python, while Data Analysts can succeed with strong SQL + BI skills alone.', order: 7 },
];

const json = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'db.json'), 'utf-8')) as DbSchema;
const faqsSource: Faq[] = json.faqs && json.faqs.length ? json.faqs : DEFAULT_FAQS;
const supabase = createClient(url, key, {
  db: { schema: 'excel_to_ai' },
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const settingsRes = await supabase.from('settings').upsert({
    id: 'speaker',
    speaker_name: json.settings.speakerName,
    speaker_title: json.settings.speakerTitle,
    speaker_image: json.settings.speakerImage,
    speaker_bio: json.settings.speakerBio,
  });
  if (settingsRes.error) throw settingsRes.error;
  console.log('settings: upserted');

  const regs = (json.registrations ?? []).map((r) => ({
    id: r.id || Math.random().toString(36).slice(2, 11),
    full_name: r.fullName,
    email: r.email,
    phone: r.phone,
    status: r.status,
    city: r.city,
    created_at: r.createdAt ?? new Date().toISOString(),
  }));
  if (regs.length) {
    const regRes = await supabase.from('registrations').upsert(regs, { onConflict: 'id' });
    if (regRes.error) throw regRes.error;
  }
  console.log(`registrations: upserted ${regs.length}`);

  const faqs = faqsSource.map((f) => ({
    id: f.id,
    question: f.q,
    answer: f.a,
    sort_order: f.order,
  }));
  if (faqs.length) {
    const faqRes = await supabase.from('faqs').upsert(faqs, { onConflict: 'id' });
    if (faqRes.error) throw faqRes.error;
  }
  console.log(`faqs: upserted ${faqs.length}`);

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
