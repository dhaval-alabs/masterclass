import { Fragment, type ReactNode } from 'react';

/**
 * Renders admin-editable text with two markup conventions:
 *   *xxx*   → green-accent span (text-[#00DF83])
 *   **xxx** → <strong> for bold/emphasis
 *   \n      → <br /> line break
 *
 * Falls back to plain text if no markers are present. Safe to render any user
 * input — we never use dangerouslySetInnerHTML, only React fragments.
 */
export function renderRich(text: string | null | undefined, opts: { highlightClass?: string } = {}): ReactNode {
  if (!text) return null;
  const highlightClass = opts.highlightClass ?? 'text-[#00DF83]';

  // First split on newlines so each line is its own row, then apply markup
  // inside each line.
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => (
    <Fragment key={lineIdx}>
      {lineIdx > 0 && <br />}
      {renderInline(line, highlightClass)}
    </Fragment>
  ));
}

function renderInline(line: string, highlightClass: string): ReactNode {
  // Split by **bold** first; then for non-bold parts, split by *highlight*.
  // ** is two asterisks, * is one — order matters.
  const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((boldPart, boldIdx) => {
    if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
      return <strong key={boldIdx}>{boldPart.slice(2, -2)}</strong>;
    }
    // Now split by *highlight*
    const highlightParts = boldPart.split(/(\*[^*]+\*)/g);
    return highlightParts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
        return <span key={`${boldIdx}-${i}`} className={highlightClass}>{part.slice(1, -1)}</span>;
      }
      return <Fragment key={`${boldIdx}-${i}`}>{part}</Fragment>;
    });
  });
}

/** Splits a newline-separated list into trimmed non-empty lines. */
export function parseBullets(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}
