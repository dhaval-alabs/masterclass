// One-click join: a registrant only ever gets their PERSONAL Zoom link, which
// opens the session directly. No Zoom registration page anywhere a registrant
// is sent: that was a second sign-up form, and the hard-coded one on the
// thank-you page pointed at an old webinar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(p, "utf8");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|mjs)$/.test(n) && !/\.test\./.test(n) ? [p] : []; });
}

test("no registrant-facing code links to a Zoom registration page", () => {
  const hits = [...files("src/components"), ...files("src/app"), ...files("src/lib")]
    .filter(f => /zoom\.us\/(webinar|meeting)\/register/i.test(read(f)));
  assert.deepEqual(hits, []);
});

test("the thank-you page shows a join button only with the personal link, else says it is on its way", () => {
  const src = read("src/components/ThankYouPage.tsx");
  assert.match(src, /\{hasPersonalZoom && \(\s*<a href=\{personalZoomUrl\}/);
  assert.match(src, /LINK_PENDING_TITLE = 'Your join link is on its way'/);
  assert.doesNotMatch(src, /webinarCtaDefault|WEBINAR_URL/);
});

test("the link registrants get is the one Zoom issues per registrant", () => {
  const zoom = read("src/lib/zoom.ts");
  assert.match(zoom, /\/webinars\/\$\{webinarId\}\/registrants/);
  assert.match(zoom, /joinUrl: body\.join_url/);
  // Verification stores it and hands it to Mindbird, which puts it in every WhatsApp message with a link.
  const verify = read("src/app/api/otp/verify/route.ts");
  assert.match(verify, /updateZoomRegistration\(registrationId, !zoomError, zoomJoinUrl\)/);
  assert.match(verify, /\{ event: 'mc_verified', joinUrl: zoomJoinUrl \|\| null \}/);
});
