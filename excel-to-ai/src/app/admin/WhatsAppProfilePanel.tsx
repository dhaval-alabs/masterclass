"use client";

import { useState, useCallback } from "react";
import {
  Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Save, Upload, UserCircle2, Globe,
} from "lucide-react";

type WaNumberKey = "otp" | "broadcast";

interface WaNumber { key: WaNumberKey; label: string; configured: boolean; }

interface WaProfile {
  about: string;
  description: string;
  address: string;
  email: string;
  vertical: string;
  websites: string[];
  profilePictureUrl: string | null;
}

interface ProfileResponse {
  profile?: WaProfile;
  numbers: WaNumber[];
  selected: WaNumberKey;
  pictureUploadAvailable: boolean;
  error?: string;
}

// Meta's business "vertical" (industry) enum, with human labels.
const VERTICALS: { value: string; label: string }[] = [
  { value: "",              label: "— Not set —" },
  { value: "EDU",           label: "Education" },
  { value: "PROF_SERVICES", label: "Professional Services" },
  { value: "FINANCE",       label: "Finance & Banking" },
  { value: "ENTERTAIN",     label: "Entertainment" },
  { value: "EVENT_PLAN",    label: "Event Planning & Service" },
  { value: "RETAIL",        label: "Shopping & Retail" },
  { value: "APPAREL",       label: "Apparel & Clothing" },
  { value: "BEAUTY",        label: "Beauty, Spa & Salon" },
  { value: "HEALTH",        label: "Medical & Health" },
  { value: "TRAVEL",        label: "Travel & Transportation" },
  { value: "HOTEL",         label: "Hotel & Lodging" },
  { value: "RESTAURANT",    label: "Restaurant" },
  { value: "GROCERY",       label: "Food & Grocery" },
  { value: "AUTO",          label: "Automotive" },
  { value: "GOVT",          label: "Public Service" },
  { value: "NONPROFIT",     label: "Non-profit" },
  { value: "OTHER",         label: "Other" },
];

const ABOUT_MAX = 139;
const DESC_MAX = 512;

export default function WhatsAppProfilePanel() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [selected, setSelected] = useState<WaNumberKey>("broadcast");
  const [pictureUploadAvailable, setPictureUploadAvailable] = useState(false);

  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [vertical, setVertical] = useState("");
  const [website1, setWebsite1] = useState("");
  const [website2, setWebsite2] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const applyProfile = useCallback((p: WaProfile | undefined) => {
    setPictureUrl(p?.profilePictureUrl ?? null);
    setAbout(p?.about ?? "");
    setDescription(p?.description ?? "");
    setAddress(p?.address ?? "");
    setEmail(p?.email ?? "");
    setVertical(p?.vertical ?? "");
    setWebsite1(p?.websites?.[0] ?? "");
    setWebsite2(p?.websites?.[1] ?? "");
  }, []);

  const load = useCallback(async (which?: WaNumberKey) => {
    setIsLoading(true);
    setLoadError(null);
    setSaveMsg(null);
    setPhotoError(null);
    try {
      const qs = which ? `?number=${which}` : "";
      const res = await fetch(`/api/admin/whatsapp/profile${qs}`);
      const data: ProfileResponse = await res.json();
      setNumbers(data.numbers ?? []);
      setSelected(data.selected ?? "broadcast");
      setPictureUploadAvailable(!!data.pictureUploadAvailable);
      applyProfile(data.profile);
      if (data.error) setLoadError(data.error);
    } catch {
      setLoadError("Couldn't reach the WhatsApp profile API.");
    } finally {
      setIsLoading(false);
      setLoaded(true);
    }
  }, [applyProfile]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  const switchNumber = (which: WaNumberKey) => {
    if (which === selected) return;
    setSelected(which);
    load(which);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/whatsapp/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: selected,
          about, description, address, email, vertical,
          websites: [website1, website2],
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveMsg({ kind: "ok", text: "Profile updated." });
      } else {
        setSaveMsg({ kind: "err", text: data.error || "Update failed." });
      }
    } catch {
      setSaveMsg({ kind: "err", text: "Network error — try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhoto = async (file: File) => {
    setIsUploadingPhoto(true);
    setPhotoError(null);
    setSaveMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("number", selected);
      const res = await fetch("/api/admin/whatsapp/profile/photo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPictureUrl(data.profilePictureUrl ?? pictureUrl);
        setSaveMsg({ kind: "ok", text: "Profile photo updated." });
      } else {
        setPhotoError(data.error || "Photo upload failed.");
      }
    } catch {
      setPhotoError("Network error during upload.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const selectableNumbers = numbers.filter(n => n.configured);
  const showNumberPicker = selectableNumbers.length > 1;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <UserCircle2 className="w-5 h-5 text-[#003368]" />
          <div>
            <div className="text-sm font-bold text-[#003368]">Business profile</div>
            <div className="text-[11px] text-slate-400">Photo, about, description &amp; details shown to people you message</div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5 space-y-5">

          {/* Number picker — only when a distinct broadcast number is configured */}
          {showNumberPicker && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Which number?</label>
              <div className="flex gap-2">
                {selectableNumbers.map(n => (
                  <button key={n.key} type="button" onClick={() => switchNumber(n.key)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                      selected === n.key
                        ? "border-[#00DF83] bg-[#00DF83]/8 text-[#003368]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
            </div>
          ) : loadError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
          ) : (
            <>
              {/* Profile photo */}
              <div className="flex items-center gap-4">
                {pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pictureUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <UserCircle2 className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div className="flex-1">
                  {pictureUploadAvailable ? (
                    <>
                      <label className={`inline-flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-[#00DF83] hover:bg-[#00DF83]/5 transition-colors ${isUploadingPhoto ? "opacity-60 pointer-events-none" : ""}`}>
                        {isUploadingPhoto
                          ? <><Loader2 className="w-4 h-4 animate-spin text-slate-400" /> Uploading…</>
                          : <><Upload className="w-4 h-4" /> {pictureUrl ? "Replace photo" : "Upload photo"}</>}
                        <input type="file" accept="image/jpeg,image/png" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.currentTarget.value = ""; }} />
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1.5">Square JPG or PNG, up to 5 MB.</p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Photo upload is disabled — set <code className="bg-slate-100 px-1 rounded">META_APP_ID</code> to enable it.
                      The fields below can still be updated.
                    </p>
                  )}
                  {photoError && <p className="text-[11px] text-red-500 mt-1.5">{photoError}</p>}
                </div>
              </div>

              {/* About */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">About (status line)</label>
                  <span className="text-[10px] text-slate-400">{about.length}/{ABOUT_MAX}</span>
                </div>
                <input type="text" value={about} maxLength={ABOUT_MAX} onChange={e => setAbout(e.target.value)}
                  placeholder="e.g. Helping learners master AI & data skills"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">Description</label>
                  <span className="text-[10px] text-slate-400">{description.length}/{DESC_MAX}</span>
                </div>
                <textarea value={description} maxLength={DESC_MAX} rows={3} onChange={e => setDescription(e.target.value)}
                  placeholder="A short description of your business"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] resize-y" />
              </div>

              {/* Email + Vertical */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Contact email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Industry</label>
                  <select value={vertical} onChange={e => setVertical(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]">
                    {VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Street, city, country"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
              </div>

              {/* Websites */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Websites <span className="font-normal text-slate-400">· up to 2</span></label>
                <div className="space-y-2">
                  {[{ v: website1, set: setWebsite1 }, { v: website2, set: setWebsite2 }].map((w, i) => (
                    <div key={i} className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input type="url" value={w.v} onChange={e => w.set(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 bg-[#003368] hover:bg-[#002347] text-white font-bold py-2 px-5 rounded-lg text-sm transition-all disabled:opacity-60">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? "Saving…" : "Save profile"}
                </button>
                {saveMsg && (
                  <span className={`text-xs flex items-center gap-1 font-semibold ${saveMsg.kind === "ok" ? "text-[#00875A]" : "text-red-600"}`}>
                    {saveMsg.kind === "ok" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {saveMsg.text}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Changes apply to the connected WhatsApp number and are visible to everyone you message. Meta may take a few minutes to reflect updates.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
