export type EntityType =
  | "PERSON" | "ORG" | "ADDRESS" | "EMAIL" | "PHONE" | "DATE_OF_BIRTH" | "DATE"
  | "SIN" | "SSN" | "EIN" | "ITIN" | "HEALTH_CARD" | "MRN" | "CREDIT_CARD" | "IBAN"
  | "ACCOUNT" | "POSTAL_CODE" | "IP_ADDRESS" | "URL" | "ID";

/** Where a span came from. "nano" = Gemini Nano on this device; "manual" = the user marked it. */
export type SpanSource = "regex" | "nano" | "manual" | "alias";

export interface Span {
  start: number;
  end: number;
  type: EntityType;
  text: string;
  source: SpanSource;
  /** Human-readable rule name for regex hits ("Canadian SIN, Luhn-checked"). */
  rule?: string;
  /** For aliases ("Doe" inside "Jane Doe"): the full value whose token this span reuses. */
  canonical?: string;
}
