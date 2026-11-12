import { mergeSpans, findAll } from "./merge";
import { aliasSpans, chunkText, locate, nanoPrompt, parseNano } from "./nano";
import { detectRegex } from "./regex";
import type { Span } from "./types";

/** Calls Gemini Nano on one chunk. Must be ONLY_ON_DEVICE; returns raw text + inferenceSource. */
export type NanoCall = (prompt: string, chunk: string) => Promise<{ text: string; source: string; ms: number }>;

export interface DetectReport {
  spans: Span[];
  regexHits: number;
  nano: {
    status: "ok" | "skipped" | "error";
    chunks: number;
    found: number;
    dropped: number;
    ms: number;
    error?: string;
    /** Raw Nano outputs, kept in memory on this device for debugging. */
    raw: string[];
  };
}

/**
 * Full local detection: regex floor + Gemini Nano + aliases + the user's manual marks.
 * Any Nano failure degrades to regex-only; it never falls back to the cloud.
 */
export async function detectAll(
  text: string,
  opts: { nano?: NanoCall; manual?: Span[]; onProgress?: (done: number, total: number) => void } = {},
): Promise<DetectReport> {
  const regex = detectRegex(text);
  const nanoSpans: Span[] = [];
  const report: DetectReport["nano"] = { status: "skipped", chunks: 0, found: 0, dropped: 0, ms: 0, raw: [] };
  if (opts.nano) {
    const chunks = chunkText(text);
    report.chunks = chunks.length;
    try {
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const r = await opts.nano(nanoPrompt(c.text), c.text);
        if (r.source !== "on_device") throw new Error(`Gemini Nano answered from "${r.source}", expected on_device. Stopped.`);
        report.ms += r.ms;
        report.raw.push(r.text);
        const ents = parseNano(r.text);
        const { spans, dropped } = locate(text, c.offset, c.text, ents);
        report.found += spans.length;
        report.dropped += dropped;
        nanoSpans.push(...spans);
        opts.onProgress?.(i + 1, chunks.length);
      }
      report.status = "ok";
    } catch (e) {
      report.status = "error";
      report.error = (e as Error).message;
    }
  }
  // A value Nano found once gets redacted everywhere it appears in the document.
  const spread: Span[] = [];
  for (const s of nanoSpans) for (const h of findAll(text, s.text)) spread.push({ ...s, start: h, end: h + s.text.length });
  const manual = opts.manual ?? [];
  const manualSpread: Span[] = [];
  for (const s of manual) for (const h of findAll(text, s.text)) manualSpread.push({ ...s, start: h, end: h + s.text.length });
  const base = [...regex, ...spread, ...manualSpread];
  const spans = mergeSpans([...base, ...aliasSpans(text, base)]);
  return { spans, regexHits: regex.length, nano: report };
}
