/**
 * Reversible tokenization. The vault lives in page memory only: it is never persisted,
 * never logged, and never sent anywhere. Same value -> same token within a session
 * (referential consistency), so the cloud model can still reason about "who did what".
 */
import type { EntityType, Span } from "./types";

export const TOKEN_RE = /\[{1,2}\s*([A-Z]+(?:_[A-Z]+)*_\d+)\s*\]{1,2}/g;

const norm = (type: EntityType, v: string) => {
  const t = v.trim().replace(/\s+/g, " ");
  return type === "PERSON" || type === "ORG" || type === "EMAIL" || type === "ADDRESS" ? t.toLowerCase() : t;
};

export interface VaultEntry {
  token: string;
  type: EntityType;
  value: string;
}

export class Vault {
  private byKey = new Map<string, VaultEntry>();
  private byToken = new Map<string, VaultEntry>();
  private counters = new Map<EntityType, number>();

  tokenFor(type: EntityType, value: string): string {
    const key = `${type}\u0000${norm(type, value)}`;
    const hit = this.byKey.get(key);
    if (hit) return hit.token;
    const n = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, n);
    const entry = { token: `${type}_${n}`, type, value: value.trim() };
    this.byKey.set(key, entry);
    this.byToken.set(entry.token, entry);
    return entry.token;
  }

  lookup(token: string): VaultEntry | undefined {
    return this.byToken.get(token);
  }

  entries(): VaultEntry[] {
    return [...this.byToken.values()];
  }

  get size(): number {
    return this.byToken.size;
  }

  clear(): void {
    this.byKey.clear();
    this.byToken.clear();
    this.counters.clear();
  }
}

export interface Redacted {
  text: string;
  /** token -> number of replacements in this text */
  counts: Record<string, number>;
}

/** Replace spans (non-overlapping, sorted) with [[TOKEN]] placeholders. */
export function redact(text: string, spans: Span[], vault: Vault): Redacted {
  let out = "";
  let pos = 0;
  const counts: Record<string, number> = {};
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < pos) continue;
    const token = vault.tokenFor(s.type, s.canonical ?? s.text);
    out += text.slice(pos, s.start) + `[[${token}]]`;
    counts[token] = (counts[token] ?? 0) + 1;
    pos = s.end;
  }
  out += text.slice(pos);
  return { text: out, counts };
}

export interface Restored {
  text: string;
  restored: number;
  /** Tokens the model invented or mangled; left in place so the user sees them. */
  unknown: string[];
}

/** Swap placeholders in a model answer back to real values. Tolerates [TOKEN] and [[ TOKEN ]]. */
export function restore(text: string, vault: Vault): Restored {
  let restored = 0;
  const unknown = new Set<string>();
  const out = text.replace(TOKEN_RE, (whole, token: string) => {
    const e = vault.lookup(token);
    if (!e) {
      unknown.add(token);
      return whole;
    }
    restored++;
    return e.value;
  });
  return { text: out, restored, unknown: [...unknown] };
}
