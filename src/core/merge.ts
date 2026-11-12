import type { Span } from "./types";

const RANK: Record<Span["source"], number> = { manual: 4, regex: 3, nano: 2, alias: 1 };

/**
 * Resolve overlapping spans into a non-overlapping, position-sorted list.
 * Priority: manual > regex (validated) > nano > alias; on ties the longer span wins.
 */
export function mergeSpans(spans: Span[]): Span[] {
  // A model-found full address ("12 Main St, Unit 4, Ottawa, ON K1S 3X7") beats the shorter
  // pattern pieces it contains, so the city between them is hidden too.
  const covers = (a: Span, b: Span) => a.start <= b.start && b.end <= a.end && a.end - a.start > b.end - b.start;
  const rank = (s: Span) =>
    s.source === "nano" && s.type === "ADDRESS" && spans.some((r) => r.source === "regex" && (r.type === "ADDRESS" || r.type === "POSTAL_CODE") && covers(s, r))
      ? 3.5
      : RANK[s.source];
  const sorted = [...spans].sort(
    (a, b) => rank(b) - rank(a) || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: Span[] = [];
  for (const s of sorted) {
    if (s.end <= s.start) continue;
    if (kept.some((k) => s.start < k.end && k.start < s.end)) continue;
    kept.push(s);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Find every whole-word occurrence of `needle` in `text` (case-sensitive). */
export function findAll(text: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle.trim()) return out;
  const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}_]/u.test(c);
  let i = text.indexOf(needle);
  while (i !== -1) {
    const before = text[i - 1];
    const after = text[i + needle.length];
    const edgeOk = (!isWord(needle[0]) || !isWord(before)) && (!isWord(needle[needle.length - 1]) || !isWord(after));
    if (edgeOk) out.push(i);
    i = text.indexOf(needle, i + 1);
  }
  return out;
}
