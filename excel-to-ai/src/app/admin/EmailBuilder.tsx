"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, Code, Type,
  AlignLeft, AlignCenter, AlignRight, MousePointer,
  Minus, Info, ChevronDown, LayoutTemplate, List,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type BlockType = "heading" | "subheading" | "text" | "list" | "image" | "button" | "divider" | "spacer" | "highlight";
type Align = "left" | "center" | "right";
type EditorMode = "visual" | "html" | "preview";

export interface EmailBlock {
  id: string;
  type: BlockType;
  value: string;
  align: Align;
  href?: string;
  buttonColor?: string;
  highlightColor?: string;
}

interface LogoSettings { logoUrl: string | null; logoAlign: "left" | "center" | "right"; logoHeight: number; headerColor: string; }

interface Props {
  subject: string;
  bannerUrl?: string | null;
  logoSettings?: LogoSettings | null;
  onChange: (html: string, text: string) => void;
  initialHtml?: string | null;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; blocks: Omit<EmailBlock, "id">[] }> = {
  reminder10: {
    label: "10-Day Reminder",
    blocks: [
      { type: "heading",   value: "Your Masterclass is in 10 Days! 🎯", align: "center" },
      { type: "text",      value: "Hi {name},\n\nWe're thrilled to see you registered for the upcoming Analytix Labs Masterclass. Your spot is confirmed and we can't wait to see you there!", align: "left" },
      { type: "highlight", value: "📅 Date: Saturday, 6 June 2026\n⏰ Time: 7:00 PM IST\n🔗 Platform: Zoom Webinar (link sent 1 hour before)", align: "left", highlightColor: "#e0f2fe" },
      { type: "text",      value: "To make the most of this session, we recommend:\n\n• Install Zoom on your device\n• Keep a notepad ready\n• Join 5 minutes early to avoid technical issues", align: "left" },
      { type: "button",    value: "View Masterclass Details", align: "center", href: "https://masterclass.analytixlabs.co.in", buttonColor: "#003368" },
      { type: "divider",   value: "", align: "left" },
      { type: "text",      value: "Any questions? Reply to this email or WhatsApp us — our team is happy to help.", align: "center" },
    ],
  },
  lastCall: {
    label: "Last Call (1 Day Before)",
    blocks: [
      { type: "heading",   value: "Tomorrow is the Day! ⚡", align: "center" },
      { type: "text",      value: "Hi {name},\n\nYour masterclass is happening TOMORROW. Here's everything you need to join seamlessly.", align: "left" },
      { type: "highlight", value: "📅 Tomorrow — Saturday, 6 June 2026\n⏰ 7:00 PM IST sharp\n⚠️ Zoom link will be sent 1 hour before", align: "left", highlightColor: "#fef9c3" },
      { type: "button",    value: "Join the Masterclass →", align: "center", href: "https://masterclass.analytixlabs.co.in", buttonColor: "#00DF83" },
      { type: "text",      value: "See you tomorrow!\nTeam Analytix Labs", align: "center" },
    ],
  },
  postWebinar: {
    label: "Post-Webinar Thank You",
    blocks: [
      { type: "heading",   value: "Thank You for Attending! 🙌", align: "center" },
      { type: "text",      value: "Hi {name},\n\nThank you for joining our masterclass. We hope you found it valuable and left with actionable insights.", align: "left" },
      { type: "subheading", value: "What's Next?", align: "left" },
      { type: "text",      value: "• Download the session recording (link below)\n• Explore our full Data Science program\n• Join our WhatsApp community for ongoing support", align: "left" },
      { type: "button",    value: "Explore Full Program", align: "center", href: "https://www.analytixlabs.co.in", buttonColor: "#003368" },
      { type: "divider",   value: "", align: "left" },
      { type: "text",      value: "We'll be in touch with more learning opportunities soon!", align: "center" },
    ],
  },
  blank: {
    label: "Blank",
    blocks: [
      { type: "heading", value: "Your email heading", align: "center" },
      { type: "text",    value: "Hi {name},\n\nWrite your message here...", align: "left" },
    ],
  },
};

// ── HTML generation ───────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const rows = blocks.map(b => {
    const align = b.align ?? "left";
    switch (b.type) {
      case "heading":
        return `<tr><td style="padding:0 0 16px;text-align:${align}">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#003368;line-height:1.3;font-family:-apple-system,sans-serif">${inlineToHtml(escHtml(b.value))}</h1>
        </td></tr>`;

      case "subheading":
        return `<tr><td style="padding:0 0 12px;text-align:${align}">
          <h2 style="margin:0;font-size:20px;font-weight:700;color:#1e293b;line-height:1.4;font-family:-apple-system,sans-serif">${inlineToHtml(escHtml(b.value))}</h2>
        </td></tr>`;

      case "text":
        return b.value.split(/\n\n+/).map(para =>
          `<tr><td style="padding:0 0 14px;text-align:${align}">
            <p style="margin:0;font-size:15px;line-height:1.7;color:#334155;font-family:-apple-system,sans-serif">${inlineToHtml(escHtml(para))}</p>
          </td></tr>`
        ).join("");

      case "image":
        return b.value
          ? `<tr><td style="padding:0 0 16px;text-align:${align}">
              <img src="${escHtml(b.value)}" alt="" style="max-width:100%;border-radius:8px;display:inline-block" />
            </td></tr>`
          : "";

      case "button": {
        const bg = b.buttonColor ?? "#003368";
        return `<tr><td style="padding:8px 0 24px;text-align:${align}">
          <a href="${escHtml(b.href ?? "#")}" style="display:inline-block;background:${bg};color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;font-family:-apple-system,sans-serif">${escHtml(b.value)}</a>
        </td></tr>`;
      }

      case "divider":
        return `<tr><td style="padding:8px 0 16px">
          <hr style="border:0;border-top:1px solid #e2e8f0;margin:0" />
        </td></tr>`;

      case "spacer":
        return `<tr><td style="height:24px;font-size:1px;line-height:1px">&nbsp;</td></tr>`;

      case "highlight": {
        const bg = b.highlightColor ?? "#f0fdf4";
        return `<tr><td style="padding:0 0 16px">
          <div style="background:${bg};border-radius:8px;padding:20px 24px;font-family:-apple-system,sans-serif">
            ${b.value.split("\n").map(line =>
              `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#1e293b;font-weight:${line.startsWith("📅") || line.startsWith("⏰") || line.startsWith("🔗") || line.startsWith("⚠️") ? "600" : "400"}">${inlineToHtml(escHtml(line))}</p>`
            ).join("")}
          </div>
        </td></tr>`;
      }

      case "list": {
        const items = b.value.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
        if (!items.length) return "";
        return `<tr><td style="padding:0 0 16px;text-align:${b.align ?? "left"}">
          <ul style="margin:0;padding-left:24px;font-size:15px;line-height:1.7;color:#334155;font-family:-apple-system,sans-serif">
            ${items.map(item => `<li style="margin-bottom:6px">${inlineToHtml(escHtml(item))}</li>`).join("\n            ")}
          </ul>
        </td></tr>`;
      }

      default:
        return "";
    }
  }).filter(Boolean).join("\n");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">\n${rows}\n</table>`;
}

export function blocksToText(blocks: EmailBlock[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case "heading":    return `${b.value.toUpperCase()}\n${"=".repeat(Math.min(b.value.length, 60))}`;
      case "subheading": return `${b.value}\n${"-".repeat(Math.min(b.value.length, 60))}`;
      case "text":       return b.value;
      case "image":      return b.value ? `[Image: ${b.value}]` : "";
      case "button":     return `>> ${b.value} (${b.href ?? "#"}) <<`;
      case "divider":    return "---";
      case "spacer":     return "";
      case "highlight":  return b.value;
      case "list":       return b.value.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).map(l => `• ${l}`).join("\n");
      default:           return "";
    }
  }).filter(Boolean).join("\n\n");
}

// ── HTML → blocks parser ──────────────────────────────────────────────────────
// Reverses blocksToHtml so Apply can update the visual editor.

function elInnerText(el: Element): string {
  return (el.innerHTML ?? "")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .trim();
}

function parseAlign(style: string): Align {
  const m = style.match(/text-align:\s*(left|center|right)/);
  return (m?.[1] ?? "left") as Align;
}

// child(el, tag) — gets the first DIRECT child element with the given tag name.
// Using .children array avoids all :scope quirks across browsers.
function child(el: HTMLElement, tag: string): HTMLElement | null {
  const upper = tag.toUpperCase();
  for (let k = 0; k < el.children.length; k++) {
    if (el.children[k].tagName === upper) return el.children[k] as HTMLElement;
  }
  return null;
}

function parseBlocksFromElements(els: HTMLElement[]): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  let i = 0;

  while (i < els.length) {
    const el  = els[i];
    const tag = el.tagName;
    const style = el.getAttribute("style") ?? "";
    const align = parseAlign(style);

    if (tag === "H1") {
      blocks.push({ id: uid(), type: "heading", value: elInnerText(el), align });
      i++;
    } else if (tag === "H2" || tag === "H3") {
      blocks.push({ id: uid(), type: "subheading", value: elInnerText(el), align });
      i++;
    } else if (tag === "HR") {
      blocks.push({ id: uid(), type: "divider", value: "", align: "left" });
      i++;
    } else if (tag === "IMG") {
      blocks.push({ id: uid(), type: "image", value: el.getAttribute("src") ?? "", align });
      i++;
    } else if (tag === "A" && el.getAttribute("href")) {
      const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/);
      blocks.push({
        id: uid(), type: "button",
        value: el.textContent?.trim() ?? "",
        align: align || "center",
        href: el.getAttribute("href") ?? "",
        buttonColor: bgMatch ? bgMatch[1].trim() : "#003368",
      });
      i++;
    } else if (tag === "DIV") {
      const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/);
      if (bgMatch) {
        // Coloured div → highlight / info box
        const lines = Array.from(el.querySelectorAll("p"))
          .map(p => p.textContent?.trim() ?? "").filter(Boolean);
        const text = lines.length > 0 ? lines.join("\n") : elInnerText(el);
        blocks.push({ id: uid(), type: "highlight", value: text, align: "left", highlightColor: bgMatch[1].trim() });
        i++;
      } else {
        // Plain wrapper div — recurse into its children
        const inner = Array.from(el.children) as HTMLElement[];
        if (inner.length > 0) {
          blocks.push(...parseBlocksFromElements(inner));
        } else {
          const t = el.textContent?.trim() ?? "";
          if (t) blocks.push({ id: uid(), type: "text", value: t, align });
        }
        i++;
      }
    } else if (tag === "P") {
      // Collect consecutive <p> siblings into one text block
      const paras: string[] = [];
      while (i < els.length && els[i].tagName === "P") {
        paras.push(elInnerText(els[i]));
        i++;
      }
      if (paras.length > 0) blocks.push({ id: uid(), type: "text", value: paras.join("\n\n"), align });
    } else if (tag === "TABLE") {
      // Nested table — parse it as table format
      const parsed = parseTableFormat(el);
      if (parsed) blocks.push(...parsed);
      i++;
    } else {
      // Unknown element — treat as text if it has content
      const t = el.textContent?.trim() ?? "";
      if (t) blocks.push({ id: uid(), type: "text", value: t, align });
      i++;
    }
  }

  return blocks;
}

function parseTableFormat(table: HTMLElement): EmailBlock[] | null {
  const tbody = child(table, "tbody") ?? table;
  const rows: HTMLElement[] = [];
  for (let k = 0; k < tbody.children.length; k++) {
    if (tbody.children[k].tagName === "TR") rows.push(tbody.children[k] as HTMLElement);
  }
  if (rows.length === 0) return null;

  const blocks: EmailBlock[] = [];
  let i = 0;

  while (i < rows.length) {
    const td = child(rows[i], "td");
    if (!td) { i++; continue; }

    const tdStyle = td.getAttribute("style") ?? "";
    const align   = parseAlign(tdStyle);
    const h1       = child(td, "h1");
    const h2       = child(td, "h2");
    const anchor   = child(td, "a");
    const hr       = child(td, "hr");
    const blockDiv = child(td, "div");
    const img      = child(td, "img");
    const p        = child(td, "p");

    if (h1) {
      blocks.push({ id: uid(), type: "heading", value: elInnerText(h1), align });
      i++;
    } else if (h2) {
      blocks.push({ id: uid(), type: "subheading", value: elInnerText(h2), align });
      i++;
    } else if (anchor && anchor.getAttribute("href")) {
      const aStyle  = anchor.getAttribute("style") ?? "";
      const bgMatch = aStyle.match(/background:\s*([^;]+)/);
      blocks.push({
        id: uid(), type: "button",
        value: anchor.textContent?.trim() ?? "",
        align,
        href: anchor.getAttribute("href") ?? "",
        buttonColor: bgMatch ? bgMatch[1].trim() : "#003368",
      });
      i++;
    } else if (hr) {
      blocks.push({ id: uid(), type: "divider", value: "", align: "left" });
      i++;
    } else if (tdStyle.replace(/\s/g, "").includes("height:24px")) {
      blocks.push({ id: uid(), type: "spacer", value: "", align: "left" });
      i++;
    } else if (blockDiv) {
      const divStyle = blockDiv.getAttribute("style") ?? "";
      const bgMatch  = divStyle.match(/background:\s*([^;]+)/);
      const lines    = Array.from(blockDiv.querySelectorAll("p"))
        .map(el => el.textContent?.trim() ?? "").filter(Boolean);
      blocks.push({
        id: uid(), type: "highlight",
        value: lines.join("\n"),
        align: "left",
        highlightColor: bgMatch ? bgMatch[1].trim() : "#e0f2fe",
      });
      i++;
    } else if (img && !anchor) {
      blocks.push({ id: uid(), type: "image", value: img.getAttribute("src") ?? "", align });
      i++;
    } else if (p) {
      const paras: string[] = [];
      while (i < rows.length) {
        const innerTd = child(rows[i], "td");
        if (!innerTd) break;
        const hasSpecial = child(innerTd, "h1") || child(innerTd, "h2") ||
                           child(innerTd, "a")  || child(innerTd, "hr") ||
                           child(innerTd, "div") || child(innerTd, "img");
        const innerP = child(innerTd, "p");
        if (hasSpecial || !innerP) break;
        paras.push(elInnerText(innerP));
        i++;
      }
      if (paras.length > 0) blocks.push({ id: uid(), type: "text", value: paras.join("\n\n"), align });
    } else {
      i++;
    }
  }

  return blocks.length > 0 ? blocks : null;
}

export function htmlToBlocks(html: string): EmailBlock[] | null {
  if (typeof document === "undefined") return null;
  try {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;

    // Path 1: table-based HTML (generated by blocksToHtml)
    const table = wrap.querySelector("table") as HTMLElement | null;
    if (table) return parseTableFormat(table);

    // Path 2: free-form HTML (<div>, <h1>, <p>, etc.)
    // Use top-level children of wrap. If there's a single wrapper div, go one level deeper.
    let topEls = Array.from(wrap.children) as HTMLElement[];
    if (topEls.length === 1 && topEls[0].tagName === "DIV") {
      topEls = Array.from(topEls[0].children) as HTMLElement[];
    }
    if (topEls.length === 0) return null;

    const blocks = parseBlocksFromElements(topEls);
    return blocks.length > 0 ? blocks : null;
  } catch (err) {
    console.error("[htmlToBlocks] parse error:", err);
    return null;
  }
}

// ── Block meta ────────────────────────────────────────────────────────────────

const BLOCK_DEFS: { type: BlockType; label: string; icon: React.ReactNode; default: Partial<EmailBlock> }[] = [
  { type: "heading",    label: "Heading",    icon: <Type className="w-4 h-4" />,           default: { value: "Your heading", align: "center" } },
  { type: "subheading", label: "Sub-heading",icon: <Type className="w-3.5 h-3.5" />,       default: { value: "Sub-heading", align: "left" } },
  { type: "text",       label: "Text",       icon: <AlignLeft className="w-4 h-4" />,      default: { value: "Write your message here...", align: "left" } },
  { type: "list",       label: "Bullet list",icon: <List className="w-4 h-4" />,           default: { value: "First point\nSecond point\nThird point", align: "left" } },
  { type: "highlight",  label: "Info box",   icon: <Info className="w-4 h-4" />,           default: { value: "Key detail here", align: "left", highlightColor: "#e0f2fe" } },
  { type: "button",     label: "Button",     icon: <MousePointer className="w-4 h-4" />,   default: { value: "Click here", align: "center", href: "https://", buttonColor: "#003368" } },
  { type: "image",      label: "Image URL",  icon: <LayoutTemplate className="w-4 h-4" />, default: { value: "", align: "center" } },
  { type: "divider",    label: "Divider",    icon: <Minus className="w-4 h-4" />,          default: { value: "", align: "left" } },
  { type: "spacer",     label: "Spacer",     icon: <ArrowDown className="w-4 h-4" />,      default: { value: "", align: "left" } },
];

const BUTTON_COLORS = [
  { label: "Brand blue",  value: "#003368" },
  { label: "Brand green", value: "#00DF83" },
  { label: "Dark",        value: "#1e293b" },
  { label: "Red",         value: "#dc2626" },
  { label: "Purple",      value: "#7c3aed" },
  { label: "Orange",      value: "#ea580c" },
];

const HIGHLIGHT_COLORS = [
  { label: "Sky blue",   value: "#e0f2fe" },
  { label: "Yellow",     value: "#fef9c3" },
  { label: "Green",      value: "#f0fdf4" },
  { label: "Purple",     value: "#f5f3ff" },
  { label: "Peach",      value: "#fff7ed" },
  { label: "Slate",      value: "#f8fafc" },
];

function isHex(v: string) { return /^#[0-9a-fA-F]{6}$/.test(v); }

function ColorInput({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets: { label: string; value: string }[];
  onChange: (c: string) => void;
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => { setHex(value); }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold shrink-0">{label}:</span>
        {presets.map(c => (
          <button key={c.value} type="button" onClick={() => { setHex(c.value); onChange(c.value); }}
            title={c.label}
            style={{ background: c.value }}
            className={`w-5 h-5 rounded-full border-2 transition-all shrink-0 ${value === c.value ? "border-slate-700 scale-110" : "border-slate-300 hover:border-slate-500"}`} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {/* Native color picker */}
        <label className="relative w-7 h-7 rounded-md overflow-hidden border border-slate-300 cursor-pointer shrink-0" title="Pick any color">
          <input
            type="color"
            value={isHex(hex) ? hex : "#003368"}
            onChange={e => { setHex(e.target.value); onChange(e.target.value); }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <span className="block w-full h-full rounded-md" style={{ background: isHex(hex) ? hex : value }} />
        </label>
        {/* Hex text input */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#00DF83]/50 focus-within:border-[#00DF83]">
          <span className="pl-2 pr-0.5 text-xs text-slate-400 font-mono select-none">#</span>
          <input
            type="text"
            maxLength={6}
            value={hex.replace(/^#/, "")}
            onChange={e => {
              const v = "#" + e.target.value.replace(/[^0-9a-fA-F]/g, "");
              setHex(v);
              if (isHex(v)) onChange(v);
            }}
            onBlur={() => { if (!isHex(hex)) setHex(value); }}
            placeholder="003368"
            className="py-1 pr-2 text-xs font-mono w-20 outline-none bg-transparent text-slate-700"
          />
        </div>
        <span className="w-5 h-5 rounded border border-slate-200 shrink-0" style={{ background: isHex(hex) ? hex : value }} />
      </div>
    </div>
  );
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeBlock(type: BlockType): EmailBlock {
  const def = BLOCK_DEFS.find(d => d.type === type)!;
  return { id: uid(), type, align: "left", value: "", ...def.default } as EmailBlock;
}

// ── Block editor row ──────────────────────────────────────────────────────────

function BlockEditor({
  block, index, total,
  onChange, onDelete, onMove,
}: {
  block: EmailBlock;
  index: number;
  total: number;
  onChange: (b: EmailBlock) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const set = (patch: Partial<EmailBlock>) => onChange({ ...block, ...patch });
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white";

  return (
    <div className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Block toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {BLOCK_DEFS.find(d => d.type === block.type)?.label ?? block.type}
        </span>
        <div className="flex items-center gap-1">
          {/* Alignment (not for divider/spacer/image) */}
          {!["divider", "spacer", "image"].includes(block.type) && (
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden mr-1">
              {(["left", "center", "right"] as Align[]).map(a => {
                const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                return (
                  <button key={a} type="button" onClick={() => set({ align: a })}
                    className={`p-1.5 transition-colors ${block.align === a ? "bg-[#003368] text-white" : "text-slate-400 hover:bg-slate-100"}`}>
                    <Icon className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={onDelete}
            className="p-1.5 rounded-md text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Block content editor */}
      <div className="p-4 space-y-3">
        {(block.type === "heading" || block.type === "subheading") && (
          <input type="text" value={block.value} onChange={e => set({ value: e.target.value })}
            placeholder="Heading text…" className={inputCls} />
        )}

        {block.type === "text" && (
          <textarea rows={4} value={block.value} onChange={e => set({ value: e.target.value })}
            placeholder="Paragraph text. Use **bold** or *italic*. Use {name} for personalisation."
            className={`${inputCls} resize-y font-mono leading-relaxed`} />
        )}

        {block.type === "list" && (
          <>
            <textarea rows={5} value={block.value} onChange={e => set({ value: e.target.value })}
              placeholder={"First point\nSecond point\nThird point"}
              className={`${inputCls} resize-y leading-relaxed`} />
            <p className="text-[11px] text-slate-400">One item per line. Supports <strong>**bold**</strong> and <em>*italic*</em>.</p>
            {/* Live preview of the list */}
            <ul className="list-disc pl-5 space-y-1">
              {block.value.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).map((item, k) => (
                <li key={k} className="text-sm text-slate-700">{item}</li>
              ))}
            </ul>
          </>
        )}

        {block.type === "highlight" && (
          <>
            <textarea rows={4} value={block.value} onChange={e => set({ value: e.target.value })}
              placeholder="Key information (one detail per line)…"
              className={`${inputCls} resize-y leading-relaxed`} />
            <ColorInput
              label="Background"
              value={block.highlightColor ?? "#e0f2fe"}
              presets={HIGHLIGHT_COLORS}
              onChange={c => set({ highlightColor: c })}
            />
          </>
        )}

        {block.type === "image" && (
          <input type="url" value={block.value} onChange={e => set({ value: e.target.value })}
            placeholder="https://… (image URL)" className={inputCls} />
        )}

        {block.type === "button" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={block.value} onChange={e => set({ value: e.target.value })}
                placeholder="Button label" className={inputCls} />
              <input type="url" value={block.href ?? ""} onChange={e => set({ href: e.target.value })}
                placeholder="https://…" className={inputCls} />
            </div>
            <ColorInput
              label="Button color"
              value={block.buttonColor ?? "#003368"}
              presets={BUTTON_COLORS}
              onChange={c => set({ buttonColor: c })}
            />
          </>
        )}

        {block.type === "divider" && (
          <div className="border-t border-slate-300 my-1" />
        )}

        {block.type === "spacer" && (
          <div className="h-4 flex items-center justify-center text-xs text-slate-300">[spacer]</div>
        )}
      </div>
    </div>
  );
}

// ── Add block menu ────────────────────────────────────────────────────────────

function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative flex justify-center">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 text-sm font-semibold hover:border-[#003368] hover:text-[#003368] transition-colors bg-white">
        <Plus className="w-4 h-4" /> Add block
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-2 gap-1 w-64">
          {BLOCK_DEFS.map(d => (
            <button key={d.type} type="button"
              onClick={() => { onAdd(d.type); setOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors text-left">
              <span className="text-slate-400">{d.icon}</span> {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Preview iframe ────────────────────────────────────────────────────────────

function buildPreviewLogoBlock(s: LogoSettings): string {
  const url = s.logoUrl ?? "/brand/Final_logo.png";
  const h = s.logoHeight;
  const img = `<img src="${url}" alt="Analytix Labs" height="${h}" style="display:block;height:${h}px;width:auto;border:0;max-width:240px" />`;
  if (s.logoAlign === "center") return `<div style="text-align:center">${img}</div>`;
  if (s.logoAlign === "right")  return `<div style="text-align:right">${img}</div>`;
  return img;
}

function PreviewPane({ html, subject, bannerUrl, logoSettings }: {
  html: string;
  subject: string;
  bannerUrl?: string | null;
  logoSettings?: LogoSettings | null;
}) {
  const settings: LogoSettings = logoSettings ?? { logoUrl: null, logoAlign: "left", logoHeight: 36, headerColor: "#003368" };
  const banner = bannerUrl ? `<img src="${bannerUrl}" alt="" style="display:block;width:100%;border-bottom:1px solid #e2e8f0" />` : "";
  const full = `<!DOCTYPE html><html lang="en" style="color-scheme:light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${subject}</title>
<style>:root{color-scheme:light only}@media(prefers-color-scheme:dark){body{background-color:#f1f5f9!important}.email-card{background-color:#ffffff!important}.email-body-cell{color:#1e293b!important;background-color:#ffffff!important}.email-footer-cell{background-color:#ffffff!important}}</style>
</head>
<body style="margin:0;padding:24px 16px;background:#f1f5f9;font-family:-apple-system,sans-serif">
  <div class="email-card" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)" data-ogsc="#ffffff">
    <div style="background:${settings.headerColor};padding:16px 40px" data-ogsc="${settings.headerColor}">${buildPreviewLogoBlock(settings)}</div>
    ${banner}
    <div class="email-body-cell" style="padding:36px 40px 24px;color:#1e293b;background:#ffffff" data-ogsc="#ffffff">${html}</div>
    <div class="email-footer-cell" style="padding:20px 40px 32px;border-top:1px solid #e2e8f0;background:#ffffff" data-ogsc="#ffffff">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">You're receiving this because you registered for an Analytix Labs masterclass.<br/>© ${new Date().getFullYear()} AnalytixLabs India Pvt. Ltd.</p>
    </div>
  </div>
</body></html>`;

  return (
    <iframe
      srcDoc={full}
      title="Email preview"
      className="w-full rounded-xl border border-slate-200"
      style={{ height: "600px" }}
      sandbox="allow-same-origin"
    />
  );
}

// ── Template picker ───────────────────────────────────────────────────────────

function TemplatePicker({ onSelect }: { onSelect: (blocks: EmailBlock[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        <LayoutTemplate className="w-3.5 h-3.5" /> Templates <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-52">
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button key={key} type="button"
              onClick={() => {
                if (confirm(`Load "${t.label}" template? This will replace the current blocks.`)) {
                  onSelect(t.blocks.map(b => ({ ...b, id: uid() })));
                }
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailBuilder({ subject, bannerUrl, logoSettings, onChange, initialHtml }: Props) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    if (initialHtml) {
      const parsed = htmlToBlocks(initialHtml);
      if (parsed && parsed.length > 0) return parsed;
    }
    return TEMPLATES.reminder10.blocks.map(b => ({ ...b, id: uid() }));
  });
  const [rawHtml, setRawHtml] = useState("");
  const [appliedHtml, setAppliedHtml] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Sync output to parent whenever blocks change.
  const syncOutput = useCallback((bs: EmailBlock[]) => {
    onChange(blocksToHtml(bs), blocksToText(bs));
  }, [onChange]);

  useEffect(() => {
    syncOutput(blocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const handleModeChange = (m: EditorMode) => {
    if (m === "html" && mode === "visual") {
      // Entering HTML from visual — always freshen rawHtml from current blocks.
      setRawHtml(blocksToHtml(blocks));
      setAppliedHtml(null);
      setApplyMsg(null);
    }
    if (m === "visual") {
      // Returning to visual — clear stale applied HTML so preview tracks live blocks.
      setAppliedHtml(null);
      setApplyMsg(null);
    }
    setMode(m);
  };

  const applyHtml = () => {
    setAppliedHtml(rawHtml);
    onChange(rawHtml, "");
    const parsed = htmlToBlocks(rawHtml);
    if (parsed && parsed.length > 0) {
      setBlocks(parsed);
      setApplyMsg({ ok: true, text: `Synced ${parsed.length} block${parsed.length !== 1 ? "s" : ""} to visual editor.` });
      setMode("visual");
    } else {
      console.warn("[applyHtml] parse returned null. rawHtml preview:", rawHtml.slice(0, 300));
      setApplyMsg({ ok: false, text: "Preview updated — HTML kept as-is (free-form structure)." });
    }
  };

  const updateBlock = useCallback((idx: number, b: EmailBlock) => {
    setBlocks(prev => prev.map((x, i) => i === idx ? b : x));
  }, []);

  const deleteBlock = useCallback((idx: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const moveBlock = useCallback((idx: number, dir: -1 | 1) => {
    setBlocks(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    setBlocks(prev => [...prev, makeBlock(type)]);
  }, []);

  // Preview tab always shows live blocks. appliedHtml is only for the
  // inline preview rendered inside the HTML editor after clicking Apply.
  const previewHtml = blocksToHtml(blocks);

  const MODE_TABS: { key: EditorMode; label: string; icon: React.ReactNode }[] = [
    { key: "visual",   label: "Visual",   icon: <Type className="w-3.5 h-3.5" /> },
    { key: "html",     label: "HTML",     icon: <Code className="w-3.5 h-3.5" /> },
    { key: "preview",  label: "Preview",  icon: <Eye  className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center bg-slate-100 p-1 rounded-lg gap-0.5">
          {MODE_TABS.map(t => (
            <button key={t.key} type="button" onClick={() => handleModeChange(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === t.key ? "bg-white shadow text-[#003368]" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {mode === "visual" && <TemplatePicker onSelect={setBlocks} />}
        {mode === "html" && (
          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            HTML is preserved across tab switches — click Apply to preview.
          </span>
        )}
      </div>

      {/* Visual editor */}
      {mode === "visual" && (
        <div className="space-y-3">
          {blocks.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No blocks yet — add one below or choose a template.
            </div>
          )}
          {blocks.map((block, idx) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={idx}
              total={blocks.length}
              onChange={b => updateBlock(idx, b)}
              onDelete={() => deleteBlock(idx)}
              onMove={dir => moveBlock(idx, dir)}
            />
          ))}
          <AddBlockMenu onAdd={addBlock} />
        </div>
      )}

      {/* HTML editor */}
      {mode === "html" && (
        <div className="space-y-3">
          <textarea
            rows={20}
            value={rawHtml}
            onChange={e => setRawHtml(e.target.value)}
            spellCheck={false}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] leading-relaxed resize-y bg-slate-900 text-green-300"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {applyMsg ? (
              <span className={`text-xs rounded-lg px-3 py-1.5 border ${applyMsg.ok ? "text-[#00875A] bg-[#00DF83]/10 border-[#00DF83]/30" : "text-amber-700 bg-amber-50 border-amber-200"}`}>
                {applyMsg.text}
              </span>
            ) : (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                Edit HTML above, then click <strong>Apply</strong>.
              </span>
            )}
            <button
              type="button"
              onClick={applyHtml}
              className="flex items-center gap-1.5 bg-[#003368] hover:bg-[#002244] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shrink-0"
            >
              <Eye className="w-3.5 h-3.5" /> Apply &amp; Preview
            </button>
          </div>
          {appliedHtml !== null && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
              <PreviewPane html={appliedHtml} subject={subject} bannerUrl={bannerUrl} logoSettings={logoSettings} />
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {mode === "preview" && (
        <PreviewPane html={previewHtml} subject={subject} bannerUrl={bannerUrl} logoSettings={logoSettings} />
      )}
    </div>
  );
}
