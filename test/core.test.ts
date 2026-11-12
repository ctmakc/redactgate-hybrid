import { describe, expect, it } from "vitest";
import { detectRegex } from "../src/core/regex";
import { ibanMod97, luhn, ohipCheck, sinCheck } from "../src/core/validators";
import { Vault, redact, restore } from "../src/core/vault";
import { checkOutgoing } from "../src/core/guard";
import { mergeSpans, findAll } from "../src/core/merge";
import { aliasSpans, chunkText, locate, parseNano } from "../src/core/nano";
import { detectAll, type NanoCall } from "../src/core/detect";
import { countByType, appendLedger, loadLedger } from "../src/core/ledger";
import { DEMOS } from "../src/demos";

const types = (t: string) => detectRegex(t).map((s) => `${s.type}:${s.text}`);

describe("validators", () => {
  it("checks Luhn, SIN, OHIP and IBAN", () => {
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(luhn("4111 1111 1111 1112")).toBe(false);
    expect(sinCheck("728 146 390")).toBe(true);
    expect(sinCheck("728 146 391")).toBe(false);
    expect(sinCheck("046 454 286")).toBe(false); // starts with 0: never issued
    expect(ohipCheck("5832-049-174-AB")).toBe(true);
    expect(ibanMod97("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(ibanMod97("DE89 3704 0044 0532 0130 01")).toBe(false);
  });
});

describe("regex floor", () => {
  it("finds the identifiers in the client email", () => {
    const hits = types(DEMOS[0].text);
    expect(hits).toContain("SIN:728 146 390");
    expect(hits).toContain("EMAIL:marco.ricci@example.com");
    expect(hits).toContain("PHONE:613-555-0142");
    expect(hits).toContain("ACCOUNT:TDX-448120");
    expect(hits).toContain("POSTAL_CODE:K1S 3X7");
  });

  it("anchors medical identifiers on their keyword and redacts only the value", () => {
    const hits = types(DEMOS[1].text);
    expect(hits).toContain("DATE_OF_BIRTH:1984-03-17");
    expect(hits).toContain("HEALTH_CARD:5832-049-174-AB");
    expect(hits).toContain("MRN:RVH-2209114");
  });

  it("skips numbers that fail their check digit", () => {
    expect(types("ref 728 146 391 and card 4111 1111 1111 1112")).toEqual([]);
  });
});

describe("vault", () => {
  it("tokenizes consistently and restores", () => {
    const v = new Vault();
    const text = "Jane Doe met Jane Doe";
    const spans = [
      { start: 0, end: 8, type: "PERSON" as const, text: "Jane Doe", source: "nano" as const },
      { start: 13, end: 21, type: "PERSON" as const, text: "Jane Doe", source: "nano" as const },
    ];
    const r = redact(text, spans, v);
    expect(r.text).toBe("[[PERSON_1]] met [[PERSON_1]]");
    expect(restore("Hi [[PERSON_1]], [PERSON_1] and [[ PERSON_1 ]]", v).text).toBe("Hi Jane Doe, Jane Doe and Jane Doe");
    const u = restore("[[PERSON_9]]", v);
    expect(u.unknown).toEqual(["PERSON_9"]);
    expect(u.text).toBe("[[PERSON_9]]");
  });

  it("aliases reuse the full name's token", () => {
    const v = new Vault();
    const text = "Daniel Okonkwo was seen. Mr. Okonkwo is stable.";
    const base = [{ start: 0, end: 14, type: "PERSON" as const, text: "Daniel Okonkwo", source: "nano" as const }];
    const spans = mergeSpans([...base, ...aliasSpans(text, base)]);
    expect(redact(text, spans, v).text).toBe("[[PERSON_1]] was seen. Mr. [[PERSON_1]] is stable.");
  });
});

describe("leak guard", () => {
  it("blocks when a vault value is still in the payload, without echoing it", () => {
    const v = new Vault();
    v.tokenFor("PERSON", "Marco Ricci");
    v.tokenFor("SIN", "728 146 390");
    const bad = checkOutgoing("Please help marco ricci with 728146390", v);
    expect(bad.ok).toBe(false);
    expect(bad.leaks.map((l) => l.token)).toEqual(expect.arrayContaining(["PERSON_1", "SIN_1"]));
    expect(JSON.stringify(bad)).not.toMatch(/Marco|728/i);
    expect(checkOutgoing("Please help [[PERSON_1]] with [[SIN_1]]", v).ok).toBe(true);
  });

  it("blocks regex-detectable identifiers even if the vault never saw them", () => {
    const r = checkOutgoing("call 613-555-0100", new Vault());
    expect(r.ok).toBe(false);
    expect(r.leaks[0]).toMatchObject({ type: "PHONE", reason: "regex" });
  });
});

describe("nano helpers", () => {
  it("parses JSON, tolerates fences and garbage", () => {
    expect(parseNano('```json\n{"entities":[{"type":"PERSON","text":"A B"}]}\n```')).toHaveLength(1);
    expect(parseNano("nope")).toEqual([]);
  });

  it("drops entities that are not in the text", () => {
    const chunk = "Seen by Dr. Hannah Lindqvist today.";
    const { spans, dropped } = locate(chunk, 0, chunk, [
      { type: "PERSON", text: "Dr. Hannah Lindqvist" },
      { type: "PERSON", text: "John Invented" },
      { type: "WEIRD", text: "today" },
    ]);
    expect(spans.map((s) => s.text)).toEqual(["Hannah Lindqvist"]);
    expect(dropped).toBe(2);
  });

  it("chunks long text at boundaries without losing characters", () => {
    const t = Array.from({ length: 60 }, (_, i) => `Paragraph ${i} ${"x".repeat(80)}`).join("\n\n");
    const chunks = chunkText(t, 500);
    expect(chunks.map((c) => c.text).join("")).toBe(t);
    for (const c of chunks) expect(t.slice(c.offset, c.offset + c.text.length)).toBe(c.text);
  });

  it("findAll respects word edges", () => {
    expect(findAll("Ann and Anna", "Ann")).toEqual([0]);
  });
});

describe("detectAll", () => {
  const email = DEMOS[0].text;
  const fakeNano =
    (source = "on_device"): NanoCall =>
    async () => ({
      text: JSON.stringify({ entities: [
        { type: "PERSON", text: "Marco Ricci" }, { type: "PERSON", text: "Priya" },
        { type: "PERSON", text: "Elena" }, { type: "ORG", text: "Harbourline Logistics" },
        { type: "ADDRESS", text: "1187 Bank Street, Unit 4, Ottawa, ON" },
      ] }),
      source,
      ms: 5,
    });

  it("combines regex and Nano and redacts the whole email", async () => {
    const r = await detectAll(email, { nano: fakeNano() });
    expect(r.nano.status).toBe("ok");
    const v = new Vault();
    const out = redact(email, r.spans, v).text;
    expect(out).not.toMatch(/Marco|Ricci|Priya|Elena|Harbourline|1187 Bank|728 146 390|613-555|TDX-448120|K1S 3X7/);
    expect(out).toContain("[[SIN_1]]");
    expect(checkOutgoing(out, v).ok).toBe(true);
  });

  it("refuses a Nano answer that came from the cloud and degrades to regex only", async () => {
    const r = await detectAll(email, { nano: fakeNano("in_cloud") });
    expect(r.nano.status).toBe("error");
    expect(r.nano.error).toMatch(/expected on_device/);
    expect(r.spans.some((s) => s.source === "nano")).toBe(false);
    expect(r.spans.some((s) => s.type === "SIN")).toBe(true);
  });

  it("applies manual marks everywhere the text appears", async () => {
    const r = await detectAll("Project Falcon is secret. Falcon ships soon.", {
      manual: [{ start: 8, end: 14, type: "ID", text: "Falcon", source: "manual" }],
    });
    expect(r.spans.filter((s) => s.text === "Falcon")).toHaveLength(2);
  });
});

describe("ledger", () => {
  it("stores only what was sent and counts tokens by type", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(countByType({ PERSON_1: 2, PERSON_2: 1, SIN_1: 1 })).toEqual({ PERSON: 3, SIN: 1 });
    appendLedger({ id: "1", at: "t", task: "x", model: "m", tier: "in_cloud", sent: "[[PERSON_1]]", sentChars: 12, tokensByType: { PERSON: 1 }, guard: "passed", inferenceSource: "in_cloud", ms: 1 }, store);
    expect(loadLedger(store)).toHaveLength(1);
  });
});

describe("street address floor", () => {
  it("finds addresses in the demos without Nano", () => {
    const got = detectRegex("new address is 1187 Bank Street, Unit 4, Ottawa and 41 Laurier Avenue East, Ottawa").filter((s) => s.type === "ADDRESS").map((s) => s.text);
    expect(got).toEqual(["1187 Bank Street, Unit 4", "41 Laurier Avenue East"]);
  });
  it("ignores amounts and years", () => {
    expect(detectRegex("about 6,200 so far in 2026 Tax Year").filter((s) => s.type === "ADDRESS")).toEqual([]);
  });
});

describe("detection quality fixes", () => {
  it("catches the name under a sign-off", async () => {
    const { detectRegex } = await import("../src/core/regex");
    const hits = detectRegex("Please confirm.\n\nThanks,\nMarco Ricci\nmarco@ricci.ca").filter((s) => s.type === "PERSON");
    expect(hits.map((h) => h.text)).toEqual(["Marco Ricci"]);
    expect(detectRegex("Best regards,\nthe team").filter((s) => s.type === "PERSON")).toEqual([]);
  });
  it("drops vague dates from Nano", async () => {
    const { specificDate } = await import("../src/core/nano");
    for (const v of ["October", "last year", "2026", "August"]) expect(specificDate(v)).toBe(false);
    for (const v of ["March 3, 1984", "2026-08-14", "14/08/2025", "3 March 1984", "Oct 14"]) expect(specificDate(v)).toBe(true);
  });
  it("prefers a full Nano address over the pattern pieces inside it", async () => {
    const { mergeSpans } = await import("../src/core/merge");
    const t = "1187 Bank Street, Unit 4, Ottawa, ON K1S 3X7";
    const out = mergeSpans([
      { start: 0, end: 24, type: "ADDRESS", text: t.slice(0, 24), source: "regex" },
      { start: 38, end: 45, type: "POSTAL_CODE", text: "K1S 3X7", source: "regex" },
      { start: 0, end: t.length, type: "ADDRESS", text: t, source: "nano" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe(t);
  });
});

describe("guard on tokenized text", () => {
  it("does not read the next line's word as an MRN after a token", async () => {
    const { detectRegex } = await import("../src/core/regex");
    expect(detectRegex("MRN:  \nAttending: Dr. X").filter((s) => s.type === "MRN")).toEqual([]);
    expect(detectRegex("MRN: RVH-2209114").map((s) => s.text)).toContain("RVH-2209114");
  });
});

describe("organization floor", () => {
  it("finds clinics, boards and companies by suffix", async () => {
    const { detectRegex } = await import("../src/core/regex");
    const t = "RIDEAU VALLEY HEALTH CENTRE - DISCHARGE\\nsee Dr. B (Westboro Family Practice, 613) and Harbourline Logistics; the bank said no; Ottawa-Carleton School Board.";
    const orgs = detectRegex(t).filter((s) => s.type === "ORG").map((s) => s.text);
    expect(orgs).toEqual(["RIDEAU VALLEY HEALTH CENTRE", "Westboro Family Practice", "Harbourline Logistics", "Ottawa-Carleton School Board"]);
  });
});
