import { describe, expect, it } from "vitest";
import { assertTier, normalizeSource, run } from "../src/hybrid";

const fakeModel = (text: string, inferenceSource: unknown) =>
  ({ generateContent: async () => ({ response: { text: () => text, inferenceSource } }) }) as never;

describe("hybrid wrapper", () => {
  it("normalizes inference source values", () => {
    expect(normalizeSource("on_device")).toBe("on_device");
    expect(normalizeSource("in_cloud")).toBe("in_cloud");
    expect(normalizeSource(undefined)).toBe("unknown");
    expect(normalizeSource("ON_DEVICE")).toBe("unknown");
  });

  it("reports text, source and elapsed time", async () => {
    let t = 100;
    const r = await run(fakeModel("ok", "on_device"), "x", () => (t += 25));
    expect(r).toEqual({ text: "ok", source: "on_device", ms: 25 });
  });

  it("refuses a result from the wrong tier", async () => {
    const r = await run(fakeModel("leak", "in_cloud"), "x");
    expect(() => assertTier(r, "on_device")).toThrow(/Expected on_device/);
    expect(assertTier(r, "in_cloud").text).toBe("leak");
  });

  it("treats an unknown source as a failure for both tiers", async () => {
    const r = await run(fakeModel("?", undefined), "x");
    expect(() => assertTier(r, "on_device")).toThrow();
    expect(() => assertTier(r, "in_cloud")).toThrow();
  });
});
