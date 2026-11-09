// Finds a citation quote inside a PDF page's text items, so it can be wrapped in <mark>.
//
// pdf.js splits a page into many text items (usually one per line, sometimes smaller), so a quote
// often spans several items. We build one normalised string for the whole page that keeps only
// letters, marks and digits (whitespace, punctuation, curly quotes, dashes and line-break hyphens
// are ignored on both sides), remember where every kept character came from, find the quote,
// then map the match back to [start, end) ranges inside each item.

export type Ranges = Map<number, [number, number]>;

export interface MatchResult {
  /** "full": the whole quote matched. "partial": a long prefix or suffix matched. "none": not on this page. */
  kind: "full" | "partial" | "none";
  ranges: Ranges;
}

const KEEP = /[\p{L}\p{M}\p{N}]/u;
const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl" };

function normChar(ch: string): string {
  const lig = LIGATURES[ch];
  if (lig) return lig;
  return KEEP.test(ch) ? ch.toLowerCase() : "";
}

export function normalise(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) out += normChar(ch);
  return out;
}

interface Haystack {
  text: string;
  // For each character of `text`: the item index and the character index inside that item.
  item: number[];
  pos: number[];
}

function buildHaystack(items: string[]): Haystack {
  const h: Haystack = { text: "", item: [], pos: [] };
  items.forEach((str, itemIndex) => {
    // Iterate by UTF-16 index so positions line up with String.slice in the renderer.
    let i = 0;
    for (const ch of str) {
      const n = normChar(ch);
      for (const c of n) {
        h.text += c;
        h.item.push(itemIndex);
        h.pos.push(i);
      }
      i += ch.length;
    }
  });
  return h;
}

function toRanges(h: Haystack, start: number, end: number, items: string[]): Ranges {
  const ranges: Ranges = new Map();
  for (let k = start; k < end; k++) {
    const it = h.item[k];
    const p = h.pos[k];
    const charEnd = p + (items[it].codePointAt(p)! > 0xffff ? 2 : 1);
    const r = ranges.get(it);
    if (!r) ranges.set(it, [p, charEnd]);
    else r[1] = Math.max(r[1], charEnd);
  }
  return ranges;
}

/** Shortest prefix/suffix (in normalised characters) we accept as a partial match. */
const MIN_PARTIAL = 24;

export function findQuote(items: string[], quote: string): MatchResult {
  const needle = normalise(quote);
  const none: MatchResult = { kind: "none", ranges: new Map() };
  if (needle.length < 2) return none;

  const h = buildHaystack(items);
  const full = h.text.indexOf(needle);
  if (full >= 0) return { kind: "full", ranges: toRanges(h, full, full + needle.length, items) };
  // Short values (e.g. "120" from a key-details table) must match in full.
  if (needle.length < MIN_PARTIAL) return none;

  // Partial: the longest prefix or suffix of the quote that appears on the page.
  const min = Math.min(MIN_PARTIAL, needle.length - 1);
  let best: [number, number] | null = null;
  for (let len = needle.length - 1; len >= min; len--) {
    const pre = h.text.indexOf(needle.slice(0, len));
    if (pre >= 0) {
      best = [pre, pre + len];
      break;
    }
    const suf = h.text.indexOf(needle.slice(needle.length - len));
    if (suf >= 0) {
      best = [suf, suf + len];
      break;
    }
  }
  if (best) return { kind: "partial", ranges: toRanges(h, best[0], best[1], items) };
  return none;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** HTML for one text item, with the matched range wrapped in <mark>. */
export function renderItem(str: string, range: [number, number] | undefined, first: boolean): string {
  if (!range) return escapeHtml(str);
  const [a, b] = range;
  return (
    escapeHtml(str.slice(0, a)) +
    `<mark class="quote-mark${first ? " quote-mark-first" : ""}">` +
    escapeHtml(str.slice(a, b)) +
    "</mark>" +
    escapeHtml(str.slice(b))
  );
}
