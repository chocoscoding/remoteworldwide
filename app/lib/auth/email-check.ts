// Whether an email address is complete enough to send, checked in the form as it's typed (owner,
// 2026-10-13). The browser's own `type="email"` check lets "admintest@gmail" through, since a
// domain with no dot is technically valid; no one signs up from one, so a name, an @, a domain and a
// dot-something ending are asked for here before the server ever sees it. The forms turn the
// browser's own checks off (`noValidate`), so its "'.' is used at a wrong position" bubble never
// shows over this one.

const COMPLETE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/** What's wrong with the address, or null when it's fine to send. */
export const emailProblem = (email: string): string | null => {
  const value = email.trim();
  if (!value) return "Enter your email address";
  if (!value.includes("@")) return "An email address needs an @";
  return COMPLETE_EMAIL.test(value) ? null : "Enter the full address, like you@example.com";
};
