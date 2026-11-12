/**
 * Check-digit and format validators for regulated identifiers.
 * Ported from RedactGate (Python, app/redaction/validators.py). Pure functions, no logging.
 */
const strip = (s: string) => s.replace(/[\s-]/g, "");
const allDigits = (s: string) => /^\d+$/.test(s);

export function luhn(s: string): boolean {
  const d = strip(s);
  if (d.length < 2 || !allDigits(d)) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = d.charCodeAt(d.length - 1 - i) - 48;
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Canadian SIN: 9 digits, Luhn, never starts with 0 or 8. */
export function sinCheck(s: string): boolean {
  const d = strip(s);
  return d.length === 9 && allDigits(d) && d[0] !== "0" && d[0] !== "8" && luhn(d);
}

/** ISO 13616 IBAN: shape + mod-97 == 1. */
export function ibanMod97(s: string): boolean {
  const c = strip(s).toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(c)) return false;
  const r = c.slice(4) + c.slice(0, 4);
  let rem = 0;
  for (const ch of r) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of v) rem = (rem * 10 + Number(digit)) % 97;
  }
  return rem === 1;
}

/** US SSN: 9 digits, excludes never-issued area/group/serial. */
export function ssnCheck(s: string): boolean {
  const d = strip(s);
  if (d.length !== 9 || !allDigits(d)) return false;
  const area = d.slice(0, 3);
  return area !== "000" && area !== "666" && d[0] !== "9" && d.slice(3, 5) !== "00" && d.slice(5) !== "0000";
}

const EIN_BAD = new Set(["07", "08", "09", "17", "18", "19", "28", "29", "49", "78", "79", "89"]);
export function einCheck(s: string): boolean {
  const d = strip(s);
  return d.length === 9 && allDigits(d) && !EIN_BAD.has(d.slice(0, 2));
}

export function itinCheck(s: string): boolean {
  const d = strip(s);
  if (d.length !== 9 || !allDigits(d) || d[0] !== "9") return false;
  const g = Number(d.slice(3, 5));
  return (g >= 50 && g <= 65) || (g >= 70 && g <= 88) || (g >= 90 && g <= 92) || (g >= 94 && g <= 99);
}

/** Ontario health card (OHIP): 10 digits, Luhn over the 10 digits (version code letters optional). */
export function ohipCheck(s: string): boolean {
  const d = strip(s).replace(/[A-Z]{1,2}$/i, "");
  return d.length === 10 && allDigits(d) && luhn(d);
}
