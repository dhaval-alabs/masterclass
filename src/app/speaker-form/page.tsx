"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, UploadCloud, User } from "lucide-react";

export default function SpeakerFormPage() {
  const [speakerName, setSpeakerName] = useState("");
  const [speakerTitle, setSpeakerTitle] = useState("");
  const [speakerBio, setSpeakerBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPhoto(f);
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!speakerName.trim()) { setError("Please enter your name."); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("speakerName", speakerName.trim());
      fd.append("speakerTitle", speakerTitle.trim());
      fd.append("speakerBio", speakerBio.trim());
      fd.append("contactEmail", contactEmail.trim());
      fd.append("contactPhone", contactPhone.trim());
      fd.append("linkedinUrl", linkedinUrl.trim());
      fd.append("notes", notes.trim());
      if (photo) fd.append("photo", photo);

      const res = await fetch("/api/speaker-submission", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) setError(data.error || "Something went wrong. Please try again.");
      else setDone(true);
    } catch {
      setError("Connection error — please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#00DF83]/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#00875A]" />
          </div>
          <h1 className="text-xl font-extrabold text-[#003368]">Thank you!</h1>
          <p className="text-sm text-slate-600 mt-2">Your details have been submitted to the AnalytixLabs team. We&apos;ll review them and set up your masterclass session shortly.</p>
        </div>
      </main>
    );
  }

  const input = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]";
  const label = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#00875A]">AnalytixLabs Masterclass</p>
          <h1 className="text-2xl font-extrabold text-[#003368] mt-1">Next Speaker — Your Details</h1>
          <p className="text-sm text-slate-500 mt-2">You&apos;re lined up to present an upcoming masterclass. Fill in your details below — our team will review and schedule it.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Photo */}
          <div>
            <label className={label}>Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {photoPreview
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  : <User className="w-8 h-8 text-slate-300" />}
              </div>
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 text-sm font-semibold text-slate-600 cursor-pointer hover:border-[#00DF83] hover:bg-[#00DF83]/5 transition-colors">
                <UploadCloud className="w-4 h-4" /> {photo ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">A clear headshot works best. Max 5 MB. Optional.</p>
          </div>

          <div>
            <label className={label}>Full name <span className="text-red-500">*</span></label>
            <input className={input} value={speakerName} onChange={e => setSpeakerName(e.target.value)} placeholder="e.g. Dr. Priya Sharma" required />
          </div>

          <div>
            <label className={label}>Title / Designation</label>
            <input className={input} value={speakerTitle} onChange={e => setSpeakerTitle(e.target.value)} placeholder="e.g. Lead Data Scientist, AnalytixLabs" />
          </div>

          <div>
            <label className={label}>Short bio</label>
            <textarea className={input} rows={4} value={speakerBio} onChange={e => setSpeakerBio(e.target.value)} placeholder="A few lines about your background and expertise (shown to attendees)." />
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Contact (for our team only — not shown publicly)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Email</label>
                <input type="email" className={input} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div>
                <label className={label}>Phone</label>
                <input className={input} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 …" />
              </div>
            </div>
            <div className="mt-4">
              <label className={label}>LinkedIn URL</label>
              <input className={input} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
            </div>
          </div>

          <div>
            <label className={label}>Anything else for the team? <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea className={input} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferred dates, topic ideas, requirements, etc." />
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-[#003368] text-white font-bold hover:bg-[#002347] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Submit my details"}
          </button>
        </form>
      </div>
    </main>
  );
}
