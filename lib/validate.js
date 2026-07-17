// Shared validation so the client and the API route always agree on what
// counts as a valid email/phone. Import this from both places rather than
// duplicating regexes.

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(value) {
  const email = (value || "").trim();
  if (email.length === 0 || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export function normalizePhone(value) {
  return (value || "").trim().replace(/[\s\-()]/g, "");
}

// Accepts either:
//  - a local Rwandan mobile number: 07XXXXXXXX (10 digits, starts with 07)
//  - an international E.164-style number: + followed by 8-14 digits
export function isValidPhone(value) {
  const cleaned = normalizePhone(value);
  if (/^07\d{8}$/.test(cleaned)) return true;
  if (/^\+\d{8,14}$/.test(cleaned)) return true;
  return false;
}

export function emailError(value) {
  if (!(value || "").trim()) return "Email is required.";
  if (!isValidEmail(value)) return "Enter a valid email address (e.g. name@mkur.ac.rw).";
  return null;
}

export function phoneError(value) {
  if (!(value || "").trim()) return "Phone number is required.";
  if (!isValidPhone(value)) {
    return "Enter a valid phone number (e.g. 078 123 4567 or +250 78 123 4567).";
  }
  return null;
}
