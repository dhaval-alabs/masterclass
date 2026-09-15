"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  KeyRound,
  UserCheck,
  UserX,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  Shuffle,
} from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// Local strong-password generator (used for the "shuffle" button next to the
// password input). Server-side generation also exists for the auto path.
function generatePassword(length = 20): string {
  const alphabet =
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const out: string[] = [];
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out.push(alphabet[bytes[i] % alphabet.length]);
  } else {
    for (let i = 0; i < length; i++)
      out.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  }
  return out.join("");
}

const PASSWORD_MIN = 8;

export default function TeamTab() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordMode, setNewPasswordMode] = useState<"auto" | "custom">("auto");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  // Password reveal modal (only shown when server generated the password)
  const [revealedPassword, setRevealedPassword] = useState<{
    email: string;
    password: string;
    context: "created" | "reset";
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Per-row reset modal
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMode, setResetMode] = useState<"auto" | "custom">("auto");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Self password change
  const [selfCurrent, setSelfCurrent] = useState("");
  const [selfNew, setSelfNew] = useState("");
  const [selfConfirm, setSelfConfirm] = useState("");
  const [selfBusy, setSelfBusy] = useState(false);
  const [selfMessage, setSelfMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showSelfNew, setShowSelfNew] = useState(false);

  // Per-row pending action
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/team", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminUser[] = await res.json();
      setAdmins(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load admins. Check the server log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    if (newPasswordMode === "custom") {
      if (newPassword.length < PASSWORD_MIN) {
        setError(`Password must be at least ${PASSWORD_MIN} characters`);
        return;
      }
    }
    setCreating(true);
    setError(null);
    setCreateMessage(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
          ...(newPasswordMode === "custom" ? { password: newPassword } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

      if (body.password) {
        // Server generated the password — show it once.
        setRevealedPassword({
          email: body.admin.email,
          password: body.password,
          context: "created",
        });
      } else {
        // Admin entered the password themselves — they already know it.
        setCreateMessage(
          `Admin ${body.admin.email} created. They can log in with the password you entered.`,
        );
      }
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewPasswordMode("auto");
      setShowNewPassword(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setCreating(false);
    }
  }

  async function handleSimpleAction(
    id: string,
    action: "deactivate" | "reactivate" | "delete",
    email: string,
  ) {
    if (action === "delete") {
      if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    }
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  }

  function openResetModal(admin: AdminUser) {
    setResetTarget(admin);
    setResetMode("auto");
    setResetPassword("");
    setShowResetPassword(false);
    setResetError(null);
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetMode === "custom" && resetPassword.length < PASSWORD_MIN) {
      setResetError(`Password must be at least ${PASSWORD_MIN} characters`);
      return;
    }
    setResetSubmitting(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/admin/team/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          ...(resetMode === "custom" ? { password: resetPassword } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const targetEmail = resetTarget.email;
      setResetTarget(null);
      if (body.password) {
        setRevealedPassword({
          email: targetEmail,
          password: body.password,
          context: "reset",
        });
      }
      await load();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleSelfChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSelfMessage(null);
    if (selfNew.length < PASSWORD_MIN) {
      setSelfMessage({ kind: "err", text: `New password must be at least ${PASSWORD_MIN} characters` });
      return;
    }
    if (selfNew !== selfConfirm) {
      setSelfMessage({ kind: "err", text: "New password and confirmation do not match" });
      return;
    }
    setSelfBusy(true);
    try {
      const res = await fetch("/api/admin/team/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: selfCurrent, newPassword: selfNew }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSelfMessage({ kind: "ok", text: "Password changed. Use the new password next time you log in." });
      setSelfCurrent("");
      setSelfNew("");
      setSelfConfirm("");
      setShowSelfNew(false);
    } catch (err) {
      setSelfMessage({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSelfBusy(false);
    }
  }

  function copyPassword() {
    if (!revealedPassword) return;
    navigator.clipboard.writeText(revealedPassword.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-bold mb-1 text-[#003368]">Team Access</h2>
      <p className="text-sm text-slate-500 mb-6">
        Add admins, reset their passwords, or revoke access. You can either enter a password yourself
        or let the system generate a strong one.
      </p>

      {/* My account — change own password */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-bold text-[#003368] uppercase tracking-wider mb-1">My account</h3>
        <p className="text-xs text-slate-500 mb-4">
          Change the password for the account you&apos;re currently signed in as.
        </p>
        <form onSubmit={handleSelfChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">
              Current password
            </label>
            <input
              type="password"
              required
              value={selfCurrent}
              onChange={(e) => setSelfCurrent(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">
              New password
            </label>
            <div className="relative">
              <input
                type={showSelfNew ? "text" : "password"}
                required
                minLength={PASSWORD_MIN}
                value={selfNew}
                onChange={(e) => setSelfNew(e.target.value)}
                autoComplete="new-password"
                className="w-full border border-slate-300 rounded-lg pl-4 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white"
              />
              <button
                type="button"
                onClick={() => setShowSelfNew((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showSelfNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">
              Confirm new password
            </label>
            <input
              type="password"
              required
              minLength={PASSWORD_MIN}
              value={selfConfirm}
              onChange={(e) => setSelfConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white"
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-4">
            <button
              type="submit"
              disabled={selfBusy}
              className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {selfBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating…
                </>
              ) : (
                "Change password"
              )}
            </button>
            {selfMessage && (
              <span
                className={`text-sm font-semibold ${
                  selfMessage.kind === "ok" ? "text-[#00875A]" : "text-red-600"
                }`}
              >
                {selfMessage.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Add admin form */}
      <form
        onSubmit={handleCreate}
        className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 space-y-4"
      >
        <h3 className="text-sm font-bold text-[#003368] uppercase tracking-wider">Add admin</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="teammate@analytixlabs.co.in"
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">
              Name <span className="font-normal text-slate-400 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tanvi Sharma"
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white"
            />
          </div>
        </div>

        {/* Password mode picker */}
        <div>
          <label className="block text-xs font-semibold mb-2 text-slate-600 uppercase tracking-wide">
            Password
          </label>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setNewPasswordMode("auto")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
                newPasswordMode === "auto"
                  ? "bg-[#003368] text-white border-[#003368]"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Generate strong password
            </button>
            <button
              type="button"
              onClick={() => setNewPasswordMode("custom")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
                newPasswordMode === "custom"
                  ? "bg-[#003368] text-white border-[#003368]"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Set my own
            </button>
          </div>
          {newPasswordMode === "custom" && (
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                minLength={PASSWORD_MIN}
                required
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${PASSWORD_MIN} characters`}
                className="w-full border border-slate-300 rounded-lg pl-4 pr-20 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  title="Generate a random password"
                  onClick={() => {
                    setNewPassword(generatePassword(20));
                    setShowNewPassword(true);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          {newPasswordMode === "auto" && (
            <p className="text-xs text-slate-500">
              A strong password will be generated and shown to you once after creation.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={creating}
          className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-5 rounded-lg text-sm transition-all flex items-center gap-2 disabled:opacity-60"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Create admin
            </>
          )}
        </button>

        {createMessage && (
          <div className="text-sm text-[#00875A] font-semibold">{createMessage}</div>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {/* Admin list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-[#003368] uppercase tracking-wider">
            {loading ? "Loading…" : `${admins.length} admin${admins.length === 1 ? "" : "s"}`}
          </h3>
          <button
            onClick={load}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No admins in the table yet. Log in once with your env credentials — they&apos;ll seed automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Email</th>
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">Last login</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const busy = pendingId === a.id;
                  return (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">{a.email}</td>
                      <td className="px-5 py-3 text-slate-600">{a.name || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{formatDate(a.lastLoginAt)}</td>
                      <td className="px-5 py-3">
                        {a.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00875A] bg-[#00DF83]/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-[#00DF83] rounded-full" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={busy}
                            onClick={() => openResetModal(a)}
                            title="Reset password"
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#003368] disabled:opacity-40"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {a.isActive ? (
                            <button
                              disabled={busy}
                              onClick={() => handleSimpleAction(a.id, "deactivate", a.email)}
                              title="Deactivate"
                              className="p-1.5 rounded-md text-slate-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => handleSimpleAction(a.id, "reactivate", a.email)}
                              title="Reactivate"
                              className="p-1.5 rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => handleSimpleAction(a.id, "delete", a.email)}
                            title="Delete"
                            className="p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset-password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-[#003368]">Reset password</h3>
              <button
                onClick={() => setResetTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Reset password for <span className="font-semibold">{resetTarget.email}</span>. The existing
                password stops working immediately.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetMode("auto")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
                    resetMode === "auto"
                      ? "bg-[#003368] text-white border-[#003368]"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Generate strong password
                </button>
                <button
                  type="button"
                  onClick={() => setResetMode("custom")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
                    resetMode === "custom"
                      ? "bg-[#003368] text-white border-[#003368]"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Set new password
                </button>
              </div>

              {resetMode === "custom" && (
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    minLength={PASSWORD_MIN}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder={`At least ${PASSWORD_MIN} characters`}
                    className="w-full border border-slate-300 rounded-lg pl-4 pr-20 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      title="Generate a random password"
                      onClick={() => {
                        setResetPassword(generatePassword(20));
                        setShowResetPassword(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      tabIndex={-1}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((v) => !v)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      tabIndex={-1}
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {resetError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md p-2">
                  {resetError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={submitReset}
                  disabled={resetSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-60"
                >
                  {resetSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Resetting…
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>
                <button
                  onClick={() => setResetTarget(null)}
                  disabled={resetSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated-password reveal modal */}
      {revealedPassword && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-[#003368]">
                {revealedPassword.context === "created" ? "Admin created" : "Password reset"}
              </h3>
              <button
                onClick={() => setRevealedPassword(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Share this password with <span className="font-semibold">{revealedPassword.email}</span>{" "}
                through a secure channel (Bitwarden, 1Password, Signal, etc.). It will{" "}
                <span className="font-semibold">not be shown again</span>.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-sm break-all select-all">
                {revealedPassword.password}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyPassword}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-4 rounded-lg text-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy password"}
                </button>
                <button
                  onClick={() => setRevealedPassword(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
