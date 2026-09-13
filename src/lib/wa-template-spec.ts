// What Meta thinks a WhatsApp template looks like — fetched from the WABA and
// used to validate a send BEFORE any message goes out.
//
// Why this exists: the Cloud API rejects a send with the opaque error
//   (#132012) Parameter format does not match format in the created template
// whenever the components we post don't line up with the approved template.
// The most common cause is a template with an IMAGE header sent without a
// header parameter — the send loop happily posts 220 messages and gets 220
// identical rejections. Catching it up front turns a wasted campaign into a
// one-line, fixable message.

import { getBroadcastCreds } from './whatsapp';

const GRAPH_API_VERSION = 'v22.0';

export type WaHeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';

export interface WaTemplateSpec {
  name: string;
  language: string;
  status: string;
  /** null when the template has no header component at all. */
  headerFormat: WaHeaderFormat | null;
  /** Distinct {{n}} placeholders in the BODY. */
  bodyVarCount: number;
}

interface RawTemplate {
  name: string;
  status: string;
  language: string;
  components?: { type?: string; format?: string; text?: string }[];
}

// The WABA template list changes rarely but the send path asks for it on every
// campaign chunk and every cron tick, so cache it briefly.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; specs: WaTemplateSpec[] } | null = null;

function distinctPlaceholders(text: string): number {
  const matches = text.match(/\{\{\s*\d+\s*\}\}/g);
  return matches ? new Set(matches.map(m => m.replace(/\s/g, ''))).size : 0;
}

function toSpec(t: RawTemplate): WaTemplateSpec {
  const header = t.components?.find(c => (c.type ?? '').toUpperCase() === 'HEADER');
  const body   = t.components?.find(c => (c.type ?? '').toUpperCase() === 'BODY');
  return {
    name: t.name,
    language: t.language,
    status: (t.status ?? '').toUpperCase(),
    headerFormat: header ? ((header.format ?? 'TEXT').toUpperCase() as WaHeaderFormat) : null,
    bodyVarCount: distinctPlaceholders(body?.text ?? ''),
  };
}

/**
 * All templates on the broadcast WABA. Returns null (rather than throwing) when
 * Meta can't be reached or credentials are missing — callers treat that as
 * "can't validate", never as "invalid", so a Graph outage can't block a send.
 */
export async function listWaTemplateSpecs(): Promise<WaTemplateSpec[] | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.specs;

  const { waAccessToken: token, wabaId } = getBroadcastCreds();
  if (!token || !wabaId) return null;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?fields=name,status,language,components&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { data?: RawTemplate[] };
    if (!Array.isArray(data.data)) return null;
    const specs = data.data.map(toSpec);
    cache = { at: Date.now(), specs };
    return specs;
  } catch {
    return null;
  }
}

/** Forget the cached list (used by tests and after a template is edited). */
export function clearWaTemplateSpecCache(): void { cache = null; }

/**
 * Why this send would be rejected by Meta, or null if it looks sendable (which
 * includes "we couldn't reach Meta to check" — validation must never be the
 * reason a legitimate campaign doesn't go out).
 */
export async function findTemplateSendProblem(params: {
  templateName: string;
  languageCode: string;
  variables: string[];
  headerImageUrl?: string | null;
}): Promise<string | null> {
  const specs = await listWaTemplateSpecs();
  if (!specs) return null;

  const { templateName, languageCode, variables, headerImageUrl } = params;
  const byName = specs.filter(s => s.name === templateName);
  if (byName.length === 0) {
    return `Template "${templateName}" does not exist on this WhatsApp account. Pick one from the template list.`;
  }

  const spec = byName.find(s => s.language === languageCode);
  if (!spec) {
    const langs = byName.map(s => s.language).join(', ');
    return `Template "${templateName}" is not published in language "${languageCode}" — it exists as: ${langs}. Set the language code to match.`;
  }

  if (spec.status !== 'APPROVED') {
    return `Template "${templateName}" is ${spec.status} in Meta, not APPROVED. Meta will reject every send until it is approved.`;
  }

  // The one that burned us: an IMAGE/VIDEO/DOCUMENT header needs a media
  // parameter on every single message. Without it Meta answers #132012.
  if (spec.headerFormat && spec.headerFormat !== 'TEXT' && spec.headerFormat !== 'LOCATION' && !headerImageUrl?.trim()) {
    return `Template "${templateName}" has an ${spec.headerFormat} header, so every message must carry a header image — none is set. Add the header image, then send again.`;
  }
  if ((!spec.headerFormat || spec.headerFormat === 'TEXT') && headerImageUrl?.trim()) {
    return `Template "${templateName}" has no image header, but a header image is set. Remove it — Meta rejects extra parameters.`;
  }

  if (spec.bodyVarCount !== variables.length) {
    return `Template "${templateName}" expects ${spec.bodyVarCount} body variable(s), but ${variables.length} ${variables.length === 1 ? 'is' : 'are'} configured. Match the count exactly.`;
  }

  return null;
}
