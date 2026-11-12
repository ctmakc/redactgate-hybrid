/**
 * Thin wrapper over Firebase AI Logic hybrid inference (firebase 13.2.0, web).
 *
 * Two model handles with different privacy guarantees:
 *  - local():  ONLY_ON_DEVICE. Never falls back to the cloud. Throws if Gemini Nano is not ready.
 *              Use it for anything that sees raw user data.
 *  - cloud():  ONLY_IN_CLOUD. Use it only with text that is safe to send.
 * PREFER_* modes are deliberately not exposed: they may silently switch tiers.
 *
 * Every result carries `source` ("on_device" | "in_cloud") from response.inferenceSource,
 * so the UI can show where each answer was computed.
 */
import type { FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from "firebase/ai";

export type Tier = "on_device" | "in_cloud";

export interface HybridResult {
  text: string;
  source: Tier | "unknown";
  ms: number;
}

export const CLOUD_MODEL = "gemini-3.5-flash-lite";

export interface HybridModels {
  local: GenerativeModel;
  cloud: GenerativeModel;
}

export function createModels(app: FirebaseApp, opts: { jsonSchema?: object } = {}): HybridModels {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const local = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: opts.jsonSchema
      ? { promptOptions: { responseConstraint: opts.jsonSchema } }
      : undefined,
  } as Parameters<typeof getGenerativeModel>[1]);
  const cloud = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL },
  } as Parameters<typeof getGenerativeModel>[1]);
  return { local, cloud };
}

/** Starts the Gemini Nano download. Call only from a user gesture (click), or Chrome refuses. */
export async function prepareDevice(
  model: GenerativeModel,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const m = model as unknown as { initializeDeviceModel?: (cb?: (p: number) => void) => Promise<void> };
  if (typeof m.initializeDeviceModel !== "function") {
    throw new Error("This firebase SDK build has no initializeDeviceModel(); check the version.");
  }
  await m.initializeDeviceModel(onProgress);
}

/** Chrome Prompt API availability, without touching Firebase. */
export async function deviceAvailability(): Promise<string> {
  const lm = (globalThis as unknown as { LanguageModel?: { availability: () => Promise<string> } }).LanguageModel;
  if (!lm) return "unsupported";
  try {
    return await lm.availability();
  } catch {
    return "unavailable";
  }
}

export function normalizeSource(raw: unknown): Tier | "unknown" {
  return raw === "on_device" || raw === "in_cloud" ? raw : "unknown";
}

export async function run(model: GenerativeModel, prompt: string, now: () => number = () => performance.now()): Promise<HybridResult> {
  const t0 = now();
  const r = await model.generateContent(prompt);
  const resp = r.response as unknown as { text: () => string; inferenceSource?: unknown };
  return { text: resp.text(), source: normalizeSource(resp.inferenceSource), ms: Math.round(now() - t0) };
}

/** Guard used before any cloud call: refuses when a result claims to be local but came from the cloud. */
export function assertTier(result: HybridResult, expected: Tier): HybridResult {
  if (result.source !== expected) {
    throw new Error(`Expected ${expected} inference, got ${result.source}. Stopping.`);
  }
  return result;
}
