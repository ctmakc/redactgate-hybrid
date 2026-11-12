/**
 * Thin wrapper over Firebase AI Logic hybrid inference (firebase 13.2.0, web).
 *
 * Three model handles with different privacy guarantees:
 *  - ner, local: ONLY_ON_DEVICE. Never fall back to the cloud. Throw if Gemini Nano is not ready.
 *               Use them for anything that sees raw user data.
 *  - cloud:      ONLY_IN_CLOUD. Use it only with text that passed the leak guard.
 * PREFER_* modes are deliberately not exposed: they may silently switch tiers.
 *
 * Every result carries `source` ("on_device" | "in_cloud") from response.inferenceSource,
 * so the UI can show where each answer was computed.
 */
import type { FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from "firebase/ai";
import { CLOUD_MODEL, TEXT_EN, normalizeSource, type HybridResult, type Tier } from "./tier";

export { CLOUD_MODEL, deviceAvailability, normalizeSource, type HybridResult, type Tier } from "./tier";

export interface HybridModels {
  /** ONLY_ON_DEVICE, JSON-constrained: the PII finder. */
  ner: GenerativeModel;
  /** ONLY_ON_DEVICE, free text: runs the whole task locally when the user keeps everything here. */
  local: GenerativeModel;
  /** ONLY_IN_CLOUD: receives tokenized text only. */
  cloud: GenerativeModel;
}

export const CLOUD_SYSTEM = [
  "You help with documents where private details were replaced on the user's device by placeholders such as [[PERSON_1]], [[SIN_1]] or [[ADDRESS_2]].",
  "Treat each placeholder as the real value it stands for.",
  "Copy placeholders into your answer exactly as written, with the double square brackets, wherever the value is needed.",
  "Never invent new placeholders, never guess or ask for the real values, never mention that the text was redacted.",
  "Write plain text: short paragraphs, and lines starting with '- ' for lists. No Markdown headings, bold or tables.",
].join(" ");

export function createModels(app: FirebaseApp, opts: { jsonSchema?: object } = {}): HybridModels {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  type Params = Parameters<typeof getGenerativeModel>[1];
  const ner = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: TEXT_EN,
      promptOptions: opts.jsonSchema ? { responseConstraint: opts.jsonSchema } : undefined,
    },
  } as Params);
  const local = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: { createOptions: TEXT_EN },
  } as Params);
  const cloud = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: CLOUD_SYSTEM },
  } as Params);
  return { ner, local, cloud };
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
