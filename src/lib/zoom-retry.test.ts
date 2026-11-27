import { test } from "node:test";
import assert from "node:assert/strict";
import { retryMissingZoomLinks, splitName, type ZoomRetryDeps } from "./zoom-retry.ts";

const START = Date.parse("2026-12-13T14:30:00Z");
const row = (id: string, fullName = "Asha Rao") => ({ id, fullName, email: `${id}@x.test`, phone: "9999000001", city: "Pune" });

function deps(over: Partial<ZoomRetryDeps> = {}) {
  const calls = { register: [] as unknown[], save: [] as [string, string][], notify: [] as [string, string][], missing: [] as unknown[] };
  const d: ZoomRetryDeps = {
    activeSession: async () => ({ id: "w14", datetimeUtc: new Date(START).toISOString(), zoomWebinarId: "87948784304" }),
    missing: async (s, l) => { calls.missing.push([s, l]); return [row("a"), row("b", "Afroze")]; },
    register: async (i) => { calls.register.push(i); return { ok: true, joinUrl: `https://zoom.test/${i.email}` }; },
    save: async (id, u) => { calls.save.push([id, u]); },
    notify: async (id, u) => { calls.notify.push([id, u]); },
    ...over,
  };
  return { d, calls };
}

test("a verified registrant with no link is registered again, saved, and Mindbird told with the link", async () => {
  const { d, calls } = deps();
  const r = await retryMissingZoomLinks(d, { now: START - 48 * 3600e3 });
  assert.deepEqual(r, { checked: 2, fixed: 2, failed: 0, skipped: null });
  assert.deepEqual(calls.missing, [["w14", 20]]);
  assert.deepEqual(calls.register[0], { email: "a@x.test", firstName: "Asha", lastName: "Rao", phone: "9999000001", city: "Pune", webinarId: "87948784304" });
  assert.deepEqual(calls.save, [["a", "https://zoom.test/a@x.test"], ["b", "https://zoom.test/b@x.test"]]);
  assert.deepEqual(calls.notify, calls.save);
});

test("still failing: nothing saved, nobody messaged, the next person is still tried", async () => {
  const { d, calls } = deps({ register: async (i) => (i.email.startsWith("a") ? { ok: false, error: "Zoom 300" } : { ok: true, joinUrl: "https://zoom.test/b" }) });
  const r = await retryMissingZoomLinks(d, { now: START - 3600e3 });
  assert.deepEqual(r, { checked: 2, fixed: 1, failed: 1, skipped: null });
  assert.deepEqual(calls.notify, [["b", "https://zoom.test/b"]]);
});

test("an error saving one person does not stop the run, and they are not reported to Mindbird", async () => {
  const { d, calls } = deps({ save: async (id) => { if (id === "a") throw new Error("db down"); } });
  const r = await retryMissingZoomLinks(d, { now: START - 3600e3 });
  assert.equal(r.fixed, 1); assert.equal(r.failed, 1);
  assert.deepEqual(calls.notify.map(c => c[0]), ["b"]);
});

test("nothing is retried once the session has started, without a start time, or with no active session", async () => {
  const { d, calls } = deps();
  assert.equal((await retryMissingZoomLinks(d, { now: START + 60e3 })).skipped, "session has started");
  assert.equal((await retryMissingZoomLinks({ ...d, activeSession: async () => ({ id: "w14", datetimeUtc: null, zoomWebinarId: null }) })).skipped, "session has no start time");
  assert.equal((await retryMissingZoomLinks({ ...d, activeSession: async () => null })).skipped, "no active session");
  assert.equal(calls.register.length, 0);
});

test("names split the way verification splits them", () => {
  assert.deepEqual(splitName("Asha Devi Rao"), { firstName: "Asha", lastName: "Devi Rao" });
  assert.deepEqual(splitName("Afroze"), { firstName: "Afroze", lastName: "" });
});
