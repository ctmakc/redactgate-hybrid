/** Light half of the hybrid layer: no Firebase import, so the first paint does not wait for the SDK. */
export type Tier = "on_device" | "in_cloud";

export interface HybridResult {
  text: string;
  source: Tier | "unknown";
  ms: number;
}

export const CLOUD_MODEL = "gemini-3.5-flash-lite";

export const TEXT_EN = { expectedInputs: [{ type: "text" as const, languages: ["en"] }], expectedOutputs: [{ type: "text" as const, languages: ["en"] }] };

/** Chrome Prompt API availability, without touching Firebase. */
export async function deviceAvailability(): Promise<string> {
  const lm = (globalThis as unknown as { LanguageModel?: { availability: (o?: object) => Promise<string> } }).LanguageModel;
  if (!lm) return "unsupported";
  try {
    return await lm.availability(TEXT_EN);
  } catch {
    return "unavailable";
  }
}

export function normalizeSource(raw: unknown): Tier | "unknown" {
  return raw === "on_device" || raw === "in_cloud" ? raw : "unknown";
}

