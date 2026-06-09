# Broadcast API

Internal, server-to-server API to send **WhatsApp** and **Email** broadcasts programmatically — from our own cron jobs, scripts, or LSQ automations. It reuses the exact same send path as the admin UI, so every send inherits the **queue, daily cap, opt-out suppression, per-recipient log, and Meta dedup** automatically.

> ⚠️ **Internal use only.** This key can message real users. Keep `BROADCAST_API_KEY` server-side. Do not expose it to browsers or third parties.

---

## Endpoint

```
POST /api/broadcast
Authorization: Bearer <BROADCAST_API_KEY>
Content-Type: application/json
```

`BROADCAST_API_KEY` is set in env (Vercel + `.env.local`). A missing/wrong key returns `401`.

---

## Request body

Three fields drive everything: `channel`, `mode`, and the content/recipients for that mode.

| Field | Type | Notes |
|---|---|---|
| `channel` | `"whatsapp" \| "email"` | **Required.** |
| `mode` | `"campaign" \| "audience" \| "recipients"` | **Required.** See modes below. |
| `campaignId` | string | Required for `mode: "campaign"`. |
| `audience` | `"verified" \| "unverified" \| "all"` | Required for `mode: "audience"`. |
| `recipients` | array | Required for `mode: "recipients"`. WhatsApp: `[{ phone, name }]`. Email: `[{ email, name }]`. |
| `scheduledFor` | ISO timestamp | **WhatsApp + `audience` mode only.** Future time → queued for the scheduled-send cron. |

**WhatsApp content** (for `audience` / `recipients` modes):
| Field | Type | Notes |
|---|---|---|
| `templateName` | string | **Required.** Approved Meta template name. |
| `languageCode` | string | Default `"en_US"`. |
| `variables` | string[] | Template body variables. `{name}` is auto-filled with the recipient's first name. |
| `headerImageUrl` | string | Public URL for an image-header template. |

**Email content** (for `audience` / `recipients` modes):
| Field | Type | Notes |
|---|---|---|
| `subject` | string | **Required.** |
| `bodyText` | string | **Required.** `{name}` → recipient's first name. |
| `bodyHtml` | string | Optional HTML body. |
| `bannerUrl` | string | Optional top banner image. |

---

## Modes

- **`campaign`** — trigger an existing campaign by `campaignId`. WhatsApp recomputes the audience fresh (so late registrants are included); Email re-resolves the campaign's saved audience and sends now.
- **`audience`** — build a fresh campaign for an audience filter and send (or schedule, WhatsApp only).
- **`recipients`** — send to an explicit list. No scheduling (use `audience` to schedule).

---

## Response

```json
{
  "success": true,
  "channel": "whatsapp",
  "mode": "audience",
  "campaignId": "wc_abc123",
  "status": "sending",
  "totalRecipients": 612,
  "sent": 80,
  "queuedRemaining": 532,
  "message": "Queued 612 recipients — 80 sent now, 532 finishing in the background."
}
```

- **WhatsApp** large sends return immediately after the first chunk (~80); the rest drain via the queue/cron — `queuedRemaining` tells you how many are still going.
- **Email** sends synchronously in the request and returns final `sent`/`failed`.
- Errors return `{ "success": false, "error": "..." }` with `400` (validation), `401` (auth), or `500`.

---

## Examples

**1. WhatsApp — ad-hoc broadcast to all verified registrants**
```bash
curl -X POST https://masterclass.analytixlabs.co.in/api/broadcast \
  -H "Authorization: Bearer $BROADCAST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "mode": "audience",
    "audience": "verified",
    "templateName": "webinar_reminder",
    "languageCode": "en",
    "variables": ["{name}", "tomorrow 6 PM"]
  }'
```

**2. WhatsApp — schedule a reminder to unverified leads**
```bash
curl -X POST .../api/broadcast -H "Authorization: Bearer $BROADCAST_API_KEY" -H "Content-Type: application/json" -d '{
  "channel": "whatsapp", "mode": "audience", "audience": "unverified",
  "templateName": "complete_registration",
  "scheduledFor": "2026-06-10T12:30:00Z"
}'
```

**3. WhatsApp — explicit recipients**
```bash
curl -X POST .../api/broadcast -H "Authorization: Bearer $BROADCAST_API_KEY" -H "Content-Type: application/json" -d '{
  "channel": "whatsapp", "mode": "recipients",
  "templateName": "webinar_reminder",
  "recipients": [{ "phone": "919876543210", "name": "Asha" }, { "phone": "919812345678", "name": "Ravi" }]
}'
```

**4. Email — ad-hoc to all**
```bash
curl -X POST .../api/broadcast -H "Authorization: Bearer $BROADCAST_API_KEY" -H "Content-Type: application/json" -d '{
  "channel": "email", "mode": "audience", "audience": "all",
  "subject": "Your webinar starts in 1 hour",
  "bodyText": "Hi {name}, the masterclass begins at 6 PM. Join link inside.",
  "bodyHtml": "<p>Hi {name}, the masterclass begins at <b>6 PM</b>.</p>"
}'
```

**5. Trigger an existing draft campaign**
```bash
curl -X POST .../api/broadcast -H "Authorization: Bearer $BROADCAST_API_KEY" -H "Content-Type: application/json" -d '{
  "channel": "email", "mode": "campaign", "campaignId": "ec_xyz789"
}'
```

---

## Guarantees & limits

- **Opt-outs & dedup:** WhatsApp respects opt-outs and the per-(campaign,phone) log; deduped by last-10 digits.
- **Daily cap:** WhatsApp obeys `WA_DAILY_LIMIT` (default 900/24h). Overflow stays queued and resumes automatically.
- **No double-send:** every send is logged per recipient; the queue marks rows processed.
- **Email** has no queue — it sends in-request in 100-address batches (same as the admin UI). Very large lists may approach the function time limit; prefer WhatsApp (queued) for the biggest sends, or split the email list.
- **Scheduling** is WhatsApp + `audience` only (the scheduler recomputes from an audience filter, so it can't replay an explicit recipient list).
