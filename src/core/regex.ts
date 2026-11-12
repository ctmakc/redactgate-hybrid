/**
 * Deterministic detection floor: regex + check-digit validators.
 * Runs first, needs no model, and is re-run on every outgoing payload by the leak guard.
 * Patterns ported and extended from RedactGate packs (generic, CA, US, EU).
 */
import type { EntityType, Span } from "./types";
import { einCheck, ibanMod97, itinCheck, luhn, ohipCheck, sinCheck, ssnCheck } from "./validators";

export interface Rule {
  type: EntityType;
  name: string;
  /** If the regex has a named group `value`, only that group is redacted. Must use the `d` flag for group indices. */
  re: RegExp;
  validate?: (v: string) => boolean;
}

export const RULES: Rule[] = [
  { type: "EMAIL", name: "Email address", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "CREDIT_CARD", name: "Payment card, Luhn-checked", re: /\b\d(?:[ -]?\d){12,18}\b/g, validate: luhn },
  { type: "IBAN", name: "IBAN, mod-97 checked", re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g, validate: ibanMod97 },
  {
    type: "HEALTH_CARD",
    name: "Ontario health card (OHIP), Luhn-checked",
    re: /\b(?:OHIP|health\s*card|HCN|health\s*number)\b[^\d\n]{0,20}(?<value>\d{4}[ -]?\d{3}[ -]?\d{3}(?:[ -]?[A-Z]{2})?)/dgi,
    validate: ohipCheck,
  },
  { type: "SIN", name: "Canadian SIN, Luhn-checked", re: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g, validate: sinCheck },
  { type: "SSN", name: "US SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g, validate: ssnCheck },
  { type: "ITIN", name: "US ITIN", re: /\b9\d{2}-\d{2}-\d{4}\b/g, validate: itinCheck },
  { type: "EIN", name: "US EIN", re: /\b\d{2}-\d{7}\b/g, validate: einCheck },
  {
    type: "PHONE",
    name: "Phone number",
    re: /(?<![\w+])(?:\+?\d{1,3}[ .-]?)?(?:\(\d{3}\)\s?|\d{3}[ .-])\d{3}[ .-]\d{4}\b(?:\s*(?:ext\.?|x)\s*\d{1,5})?/gi,
  },
  {
    type: "MRN",
    name: "Medical record / patient ID (keyword-anchored)",
    re: /\b(?:MRN|medical\s+record\s+(?:no\.?|number|#)|patient\s+(?:id|no\.?|number|#)|chart\s*(?:no\.?|#))\s*[:#]?\s*(?<value>[A-Z0-9][A-Z0-9-]{3,15})\b/dgi,
  },
  {
    type: "ACCOUNT",
    name: "Account / policy / claim number (keyword-anchored)",
    re: /\b(?:account|acct|policy|claim|member|client|customer|file|case|reference|ref)\s*(?:no\.?|number|#|id)\s*[:#]?\s*(?<value>[A-Z0-9][A-Z0-9-]{3,20})\b/dgi,
  },
  {
    type: "DATE_OF_BIRTH",
    name: "Date of birth (keyword-anchored)",
    re: /\b(?:born(?:\s+on)?|DOB|D\.O\.B\.|date\s+of\s+birth|birth\s*date)\s*[:-]?\s*(?<value>\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/dgi,
  },
  { type: "POSTAL_CODE", name: "Canadian postal code", re: /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/g },
  { type: "IP_ADDRESS", name: "IPv4 address", re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
];

export function detectRegex(text: string, rules: Rule[] = RULES): Span[] {
  const out: Span[] = [];
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      let start = m.index!;
      let value = m[0];
      const g = m.indices?.groups?.value;
      if (g && m.groups?.value !== undefined) {
        [start] = g;
        value = m.groups.value;
      }
      if (rule.validate && !rule.validate(value)) continue;
      out.push({ start, end: start + value.length, type: rule.type, text: value, source: "regex", rule: rule.name });
    }
  }
  return out;
}
