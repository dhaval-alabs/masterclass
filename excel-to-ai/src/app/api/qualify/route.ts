import { NextRequest, NextResponse } from 'next/server';
import { sendMetaCapiEvent, extractClientContext } from '@/lib/meta';
import { scoreConversation, scoreAndSave, type LeadScore, type ConversationTurn } from '@/lib/qualify';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// LSQ field that holds the lead tier. Set LSQ_LEAD_SCORE_FIELD in env to override.
const LSQ_SCORE_FIELD = process.env.LSQ_LEAD_SCORE_FIELD || 'mx_Lead_Score';
// LSQ field that holds the Gemini Q&A transcript. Create a multi-line text field
// in LSQ and set LSQ_CHAT_FIELD to its schema name (default mx_Chat_Transcript).
const LSQ_CHAT_FIELD = process.env.LSQ_CHAT_FIELD || 'mx_Chat_Transcript';
const LSQ_SCORE_LABEL: Record<string, string> = { hot: 'Hot', warm: 'Warm', cold: 'Cold', junk: 'Junk' };

// Formats the qualification conversation into a readable transcript for the CRM.
// Q = the assistant's question, A = the prospect's answer. Capped to stay within
// LSQ's text-field length limit.
function buildTranscript(conversation: ConversationTurn[], score: LeadScore, reason: string): string {
  const lines = conversation
    .filter(m => m.content?.trim())
    .map(m => `${m.role === 'assistant' ? 'Q' : 'A'}: ${m.content.trim()}`);
  const header = `Lead Score: ${LSQ_SCORE_LABEL[score]}${reason ? ` — ${reason}` : ''}`;
  let text = `${header}\n\n${lines.join('\n')}`;
  if (text.length > 3000) text = text.slice(0, 2990) + '…';
  return text;
}

async function updateLsqLeadScore(phone: string | undefined, email: string | undefined, score: LeadScore, conversation: ConversationTurn[], reason: string): Promise<void> {
  const access = process.env.LSQ_ACCESS;
  const secret = process.env.LSQ_SECRET;
  if (!access || !secret) return;
  try {
    let prospectId: string | null = null;
    if (phone) {
      const res = await fetch(`https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${access}&secretKey=${secret}&phone=${encodeURIComponent(phone)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data) && data.length > 0) prospectId = data[0].ProspectID ?? null;
    }
    if (!prospectId && email) {
      const res = await fetch(`https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByEmailAddress?accessKey=${access}&secretKey=${secret}&emailaddress=${encodeURIComponent(email)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data) && data.length > 0) prospectId = data[0].ProspectID ?? null;
    }
    if (!prospectId) { console.warn('[qualify] LSQ lead not found — score not tagged'); return; }
    // Write the tier + the full Gemini Q&A transcript in one update.
    await fetch(`https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.Update?accessKey=${access}&secretKey=${secret}&leadId=${prospectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { Attribute: LSQ_SCORE_FIELD, Value: LSQ_SCORE_LABEL[score] },
        { Attribute: LSQ_CHAT_FIELD,  Value: buildTranscript(conversation, score, reason) },
      ]),
    });
  } catch (err) {
    console.error('[qualify] LSQ score tag failed:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      registrationId?: string;
      email?: string;
      phone?: string;
      name?: string;
      city?: string;
      conversation: ConversationTurn[];
    };

    const { registrationId, email, phone, name, city, conversation } = body;

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return NextResponse.json({ error: 'conversation is required' }, { status: 400 });
    }

    const { score, reason } = await scoreConversation(conversation);

    // 1. Write tier + persist conversation to internal DB
    if (registrationId) {
      await scoreAndSave({ registrationId, conversation, label: '[qualify]' });
    }

    // 2. Tag lead in LSQ CRM — fire-and-forget
    //    Hot/Warm → sales queue  |  Cold → nurture drip  |  Junk → filtered out
    updateLsqLeadScore(phone, email, score, conversation, reason).catch(err =>
      console.error('[qualify] LSQ tag fire-and-forget failed:', err),
    );

    // 3. Meta CAPI — QualifiedLead (hot/warm) | JunkLead (junk) | cold fires nothing
    if (score !== 'cold' && (email || phone)) {
      const eventName = score === 'junk' ? 'JunkLead' : 'QualifiedLead';
      const clientCtx = extractClientContext(req);
      // Deterministic event_id keyed on the registration so a repeated qualify
      // (re-chat, network retry, double-submit) dedups at Meta instead of
      // double-counting — mirrors the `attended_${id}` pattern. Falls back to a
      // random id only when there's no registration to key on (can't dedup then).
      const qualifyEventId = registrationId ? `qualify_${registrationId}` : crypto.randomUUID();
      sendMetaCapiEvent({
        eventName,
        eventTime: Math.floor(Date.now() / 1000),
        eventId: qualifyEventId,
        userData: {
          email: email ?? undefined,
          phone: phone ?? undefined,
          firstName: name ? name.split(' ')[0] : undefined,
          lastName: name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : undefined,
          city: city ?? undefined,
          externalId: registrationId ?? undefined,
          clientIp: clientCtx.ip,
          clientUserAgent: clientCtx.userAgent,
        },
        customData: { lead_score: score, content_name: 'Lead Qualification' },
      }).catch(err => console.error('[qualify] Meta CAPI failed:', err));
    }

    return NextResponse.json({ success: true, score, reason });
  } catch (err) {
    console.error('[qualify] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
