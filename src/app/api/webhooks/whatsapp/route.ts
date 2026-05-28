import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { updateWhatsAppSendLogByMessageId } from '@/lib/db';

// ── Webhook verification (GET) ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode        = searchParams.get('hub.mode');
  const token       = searchParams.get('hub.verify_token');
  const challenge   = searchParams.get('hub.challenge');

  const verifyToken = process.env.META_WA_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── Webhook payload types ─────────────────────────────────────────────────────

interface MetaStatus {
  id: string;
  status: 'delivered' | 'read' | 'sent' | 'failed';
  timestamp: string;
  recipient_id: string;
}

interface MetaChange {
  value?: {
    statuses?: MetaStatus[];
  };
}

interface MetaEntry {
  changes?: MetaChange[];
}

interface MetaWebhookPayload {
  entry?: MetaEntry[];
}

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Delivery/read status handler (POST) ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.META_WA_WEBHOOK_SECRET;

  // Read raw body for signature verification.
  const rawBody = await req.text();

  // Verify signature if secret is configured.
  if (webhookSecret) {
    const signature = req.headers.get('x-hub-signature-256');
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updatePromises: Promise<void>[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const { id: messageId, status: statusValue, timestamp } = status;

        if (statusValue === 'delivered') {
          // Convert Unix timestamp (seconds) to ISO string.
          const deliveredAt = new Date(Number(timestamp) * 1000).toISOString();
          updatePromises.push(
            updateWhatsAppSendLogByMessageId(messageId, {
              status: 'delivered',
              deliveredAt,
            }).catch(err =>
              console.error(`[WA webhook] Failed to update delivered status for ${messageId}:`, err),
            ),
          );
        } else if (statusValue === 'read') {
          const readAt = new Date(Number(timestamp) * 1000).toISOString();
          updatePromises.push(
            updateWhatsAppSendLogByMessageId(messageId, {
              status: 'read',
              readAt,
            }).catch(err =>
              console.error(`[WA webhook] Failed to update read status for ${messageId}:`, err),
            ),
          );
        }
        // 'sent' and 'failed' statuses from webhook are ignored here —
        // 'sent' is already recorded at send time, 'failed' delivery
        // failures would need separate handling.
      }
    }
  }

  // Await all updates — errors are caught individually above so they don't
  // prevent returning 200 to Meta (which would cause retries).
  await Promise.all(updatePromises);

  return NextResponse.json({ ok: true });
}
