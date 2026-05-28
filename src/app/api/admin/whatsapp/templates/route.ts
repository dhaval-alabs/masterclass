export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const GRAPH_API_VERSION = 'v22.0';

export interface WaTemplate {
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | string;
  language: string;
  category: string;
  components: { type: string; text?: string; parameters?: unknown[] }[];
}

// GET /api/admin/whatsapp/templates
export async function GET() {
  const token   = process.env.META_WA_ACCESS_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  const wabaId  = process.env.META_WABA_ID;

  if (!token || !phoneId) {
    return NextResponse.json(
      { error: 'META_WA_ACCESS_TOKEN or META_WA_PHONE_NUMBER_ID not configured' },
      { status: 503 },
    );
  }

  const accountId = wabaId ?? await discoverWabaId(token, phoneId);
  if (!accountId) {
    return NextResponse.json(
      { error: 'Could not resolve WhatsApp Business Account ID. Add META_WABA_ID=<your-waba-id> to .env.local. Find it in Meta Business Manager → WhatsApp → API Setup.' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/message_templates?fields=name,status,language,category,components&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    if (!res.ok) {
      const err = data?.error;
      const isPermission = err?.code === 200 || err?.message?.includes('permission');
      const hint = isPermission
        ? ' — Token needs "whatsapp_business_management" permission. Generate a System User token in Meta Business Manager → System Users.'
        : '';
      return NextResponse.json(
        { error: err ? `Meta API error ${err.code}: ${err.message}${hint}` : `HTTP ${res.status}` },
        { status: res.status },
      );
    }
    const templates: WaTemplate[] = data.data ?? [];
    return NextResponse.json({ templates, wabaId: accountId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function discoverWabaId(token: string, phoneId: string): Promise<string | null> {
  try {
    // Strategy 1: phone number object has a whatsapp_business_account edge
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}?fields=id,whatsapp_business_account`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (phoneRes.ok) {
      const phoneData = await phoneRes.json();
      const wabaId = phoneData?.whatsapp_business_account?.id;
      if (wabaId) return wabaId;
    }

    // Strategy 2: /me → /businesses → /owned_whatsapp_business_accounts
    const meRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=id`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!meRes.ok) return null;
    const me = await meRes.json();
    const userId = me?.id;
    if (!userId) return null;

    const bizRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${userId}/businesses?fields=id,name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!bizRes.ok) return null;
    const bizData = await bizRes.json();
    const businessId = bizData?.data?.[0]?.id;
    if (!businessId) return null;

    // Get the actual WhatsApp Business Account (WABA) under this business
    const wabaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/owned_whatsapp_business_accounts?fields=id,name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (wabaRes.ok) {
      const wabaData = await wabaRes.json();
      const wabaId = wabaData?.data?.[0]?.id;
      if (wabaId) return wabaId;
    }

    // Strategy 3: client_whatsapp_business_accounts (for shared/partner accounts)
    const clientWabaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/client_whatsapp_business_accounts?fields=id,name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (clientWabaRes.ok) {
      const clientData = await clientWabaRes.json();
      const wabaId = clientData?.data?.[0]?.id;
      if (wabaId) return wabaId;
    }

    return null;
  } catch {
    return null;
  }
}
