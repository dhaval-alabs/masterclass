/**
 * Form field validators for the registration form. Each validator returns
 * `null` if the input is valid, or a user-facing error message if not.
 *
 * The browser's built-in `required` / `type="email"` checks are lenient;
 * these add stricter rules to filter out garbage submissions (numbers in
 * names, "asdf" emails, disposable inboxes, etc.).
 */

// ─── Full Name ──────────────────────────────────────────────────────────────
// Allowed: Latin + Devanagari + Tamil + Bengali letters, spaces, dots, hyphens, apostrophes.
// Length 2–80. Must contain at least one letter. No three identical chars in a row.
export function validateName(input: string): string | null {
  const v = (input ?? '').trim();
  if (v.length < 2) return 'Please enter your full name (at least 2 characters).';
  if (v.length > 80) return 'Name is too long (max 80 characters).';
  if (/\d/.test(v)) return 'Name cannot contain numbers.';
  if (!/[\p{L}]/u.test(v)) return 'Name must contain at least one letter.';
  // Allow Unicode letters (\p{L}) AND combining marks (\p{M}) so Devanagari /
  // Tamil / Bengali / Arabic etc. names with vowel diacritics pass.
  if (!/^[\p{L}\p{M} '\-.]+$/u.test(v)) return 'Name can only contain letters, spaces, hyphens, apostrophes, and dots.';
  if (/(.)\1{2,}/.test(v)) return 'Please enter a real name.';
  // Catch keyboard-mashed names like "asasas", "qqqqqq" — long inputs with
  // ≤ 2 distinct letters. Threshold of 6 lets short real names like
  // "Anna", "Tata", "Coco" pass.
  const lettersOnly = v.toLowerCase().replace(/[^\p{L}\p{M}]/gu, '');
  const distinct = new Set(lettersOnly.split('')).size;
  if (lettersOnly.length >= 6 && distinct <= 2) return 'Please enter a real name.';

  // Reject single-token names that are obviously placeholder.
  const lower = v.toLowerCase();
  const blocklist = new Set([
    'test', 'asdf', 'asdasd', 'qwerty', 'qwert', 'asdfg', 'asdfgh',
    'demo', 'dummy', 'fake', 'name', 'user', 'admin', 'abc', 'xyz', 'aaa',
    'first last', 'first', 'last', 'firstname', 'lastname', 'full name',
    'na', 'n/a', 'none', 'nope', 'nothing', 'unknown',
  ]);
  if (blocklist.has(lower)) return 'Please enter your real name.';
  return null;
}

// ─── Email ──────────────────────────────────────────────────────────────────
// RFC 5322 simplified, with explicit checks for common typos and disposable
// providers (mailinator, tempmail, etc.).
const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

// Common disposable email domains. Extend as you spot more in registrations.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com',
  'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'yopmail.com',
  'throwaway.email', 'maildrop.cc', '10minutemail.com', '10minutemail.net',
  'trashmail.com', 'trash-mail.com', 'mintemail.com', 'fakeinbox.com',
  'getairmail.com', 'spamgourmet.com', 'mytrashmail.com', 'tempinbox.com',
  'dispostable.com', 'meltmail.com', 'getnada.com', 'mvrht.net',
  'mailnesia.com', 'spam4.me', 'mail-temp.com', 'inboxbear.com',
]);

// Common typos for popular providers. Suggest the fix to the user if matched.
const EMAIL_TYPO_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com', 'gmali.com': 'gmail.com',
  'yhoo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com', 'yaoo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'outloo.com': 'outlook.com', 'outlook.con': 'outlook.com',
};

export function validateEmail(input: string): string | null {
  const v = (input ?? '').trim().toLowerCase();
  if (!v) return 'Please enter your email address.';
  if (v.length > 254) return 'Email address is too long.';
  if (!EMAIL_RE.test(v)) return 'Please enter a valid email address (e.g. you@example.com).';

  const domain = v.split('@')[1] ?? '';
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return 'Please use a permanent email address (disposable inboxes are not accepted).';
  }
  if (EMAIL_TYPO_FIXES[domain]) {
    return `Did you mean ${v.split('@')[0]}@${EMAIL_TYPO_FIXES[domain]}?`;
  }
  // Reject obvious garbage local-parts
  if (/^(test|asdf|qwerty|demo|fake|dummy|user|abc|xyz)$/i.test(v.split('@')[0] ?? '')) {
    return 'Please enter your real email address.';
  }
  return null;
}

/** Normalize an email to its canonical lowercase form for storage. */
export function normalizeEmail(input: string): string {
  return (input ?? '').trim().toLowerCase();
}

// ─── Phone ──────────────────────────────────────────────────────────────────
// Indian mobile: 10 digits, starts with 6/7/8/9. Strips spaces/dashes/+91 prefix.
export function validatePhone(input: string): string | null {
  const digits = normalizePhone(input);
  if (!digits) return 'Please enter your WhatsApp number.';
  if (digits.length !== 10) return 'Please enter a 10-digit Indian mobile number.';
  if (!/^[6-9]/.test(digits)) return 'Mobile number must start with 6, 7, 8, or 9.';
  if (/^(\d)\1{9}$/.test(digits)) return 'Please enter a real mobile number.';        // 9999999999, 8888888888
  if (/^(0123456789|1234567890|9876543210|0987654321)$/.test(digits)) {
    return 'Please enter a real mobile number.';                                       // sequential
  }
  return null;
}

/** Strip everything except digits, drop a leading "91" if user pasted "+91...". */
export function normalizePhone(input: string): string {
  let digits = (input ?? '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits;
}
