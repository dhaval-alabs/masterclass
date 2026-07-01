import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { updateWhatsAppSendLogByMessageId, updateOtpDeliveryByMessageId } from '@/lib/db';

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
  // Present on 'failed' statuses — this is where Meta tells us WHY delivery
  // failed (e.g. code 131042 = payment/billing issue, 131026 = undeliverable).
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
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
        // Convert Unix timestamp (seconds) to ISO string.
        const isoTs = new Date(Number(timestamp) * 1000).toISOString();

        // Every status is applied to BOTH stores by message id: campaign sends
        // live in whatsapp_send_log, OTP sends live on the registration row.
        // A wamid belongs to exactly one, so the other update is a harmless
        // no-op (matches zero rows).
        if (statusValue === 'delivered' || statusValue === 'read') {
          const logUpdate = statusValue === 'delivered'
            ? { status: 'delivered' as const, deliveredAt: isoTs }
            : { status: 'read' as const, readAt: isoTs };
          updatePromises.push(
            updateWhatsAppSendLogByMessageId(messageId, logUpdate).catch(err =>
              console.error(`[WA webhook] send_log ${statusValue} update failed for ${messageId}:`, err),
            ),
            updateOtpDeliveryByMessageId(messageId, { whatsappStatus: statusValue }).catch(err =>
              console.error(`[WA webhook] registration ${statusValue} update failed for ${messageId}:`, err),
            ),
          );
        } else if (statusValue === 'failed') {
          // This is the signal that used to be discarded. Meta tells us WHY
          // here — persist the code so a billing/verification block (accepted
          // by the send API but never delivered) is finally visible.
          const err0 = status.errors?.[0];
          const detail = err0
            ? `code=${err0.code ?? '?'}: ${err0.title ?? err0.message ?? 'unknown'}${err0.error_data?.details ? ` — ${err0.error_data.details}` : ''}`
            : 'delivery failed (no error detail)';
          console.error(`[WA webhook] FAILED delivery for ${messageId}: ${detail}`);
          updatePromises.push(
            updateWhatsAppSendLogByMessageId(messageId, { status: 'failed', errorDetail: detail }).catch(err =>
              console.error(`[WA webhook] send_log failed update failed for ${messageId}:`, err),
            ),
            updateOtpDeliveryByMessageId(messageId, { whatsappStatus: 'failed', whatsappError: detail }).catch(err =>
              console.error(`[WA webhook] registration failed update failed for ${messageId}:`, err),
            ),
          );
        }
        // 'sent' is ignored — already recorded at send time.
      }
    }
  }

  // Await all updates — errors are caught individually above so they don't
  // prevent returning 200 to Meta (which would cause retries).
  await Promise.all(updatePromises);

  return NextResponse.json({ ok: true });
}
