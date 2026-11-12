/**
 * "What left this device" journal. Holds only what was actually sent: tokenized text,
 * token counts, model, tier and timings. Persisted in localStorage; never contains vault values.
 */
export interface LedgerEntry {
  id: string;
  at: string;
  task: string;
  model: string;
  tier: "in_cloud" | "on_device";
  /** Exact payload handed to the cloud model (tokens only). Empty for on-device runs. */
  sent: string;
  sentChars: number;
  tokensByType: Record<string, number>;
  guard: "passed" | "blocked";
  inferenceSource: string;
  ms: number;
}

const KEY = "redactgate-hybrid.ledger.v1";

export function loadLedger(store: Pick<Storage, "getItem"> = localStorage): LedgerEntry[] {
  try {
    return JSON.parse(store.getItem(KEY) ?? "[]") as LedgerEntry[];
  } catch {
    return [];
  }
}

export function appendLedger(e: LedgerEntry, store: Pick<Storage, "getItem" | "setItem"> = localStorage): LedgerEntry[] {
  const all = [e, ...loadLedger(store)].slice(0, 200);
  store.setItem(KEY, JSON.stringify(all));
  return all;
}

export function clearLedger(store: Pick<Storage, "removeItem"> = localStorage): void {
  store.removeItem(KEY);
}

export function countByType(counts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [token, n] of Object.entries(counts)) {
    const type = token.replace(/_\d+$/, "");
    out[type] = (out[type] ?? 0) + n;
  }
  return out;
}
