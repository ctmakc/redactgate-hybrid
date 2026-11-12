/**
 * Leak guard: the last check before anything is handed to the cloud model.
 * 1. No vault value may appear in the outgoing text (case-insensitive; numbers also compared without separators).
 * 2. The deterministic regex floor must find nothing in the outgoing text.
 * Findings name the token and type only; raw values are never returned.
 */
import { detectRegex } from "./regex";
import { TOKEN_RE, type Vault } from "./vault";
import type { EntityType } from "./types";

export interface Leak {
  type: EntityType;
  token?: string;
  reason: "vault-value" | "regex";
  rule?: string;
}

const squash = (s: string) => s.replace(/[\s().-]/g, "");

export function checkOutgoing(outgoing: string, vault: Vault): { ok: boolean; leaks: Leak[] } {
  const leaks: Leak[] = [];
  const withoutTokens = outgoing.replace(TOKEN_RE, " ");
  const lower = withoutTokens.toLowerCase();
  const squashed = squash(withoutTokens).toLowerCase();
  for (const e of vault.entries()) {
    const v = e.value.trim();
    if (v.length < 3) continue;
    const isNumeric = /^[\d\s().+-]+$/.test(v);
    const hit = isNumeric
      ? squash(v).length >= 4 && squashed.includes(squash(v))
      : new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(v.toLowerCase())}($|[^\\p{L}\\p{N}])`, "u").test(lower);
    if (hit) leaks.push({ type: e.type, token: e.token, reason: "vault-value" });
  }
  for (const s of detectRegex(withoutTokens)) leaks.push({ type: s.type, reason: "regex", rule: s.rule });
  return { ok: leaks.length === 0, leaks };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
