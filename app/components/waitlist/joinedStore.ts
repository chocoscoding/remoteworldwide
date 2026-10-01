// What this browser knows about its waitlist signup, shared by every form on /waitlist and the
// floating "Join" pill: join in one place and the others turn into "You're on the list" at once.
// Storage can be missing (private windows, blocked site data), so every access is guarded and a
// blank answer just means "not joined yet".

/** Shared with the blog's lead-magnet cards, so a reader never types their address twice. */
export const EMAIL_KEY = "rww_lead_email";
/** What this browser last joined as, so coming back shows the spot instead of an empty form. */
export const JOINED_KEY = "rww_waitlist";

/** Fired on this window after a join, since `storage` events only reach the other tabs. */
const CHANGED = "rww-waitlist-change";

export type Joined = { email: string; position: number | null; returning: boolean };

export const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the signup itself already succeeded.
  }
};

/** Records a join and tells this tab's other forms; other tabs hear it through `storage`. */
export const saveJoined = (email: string, position: number | null) => {
  write(EMAIL_KEY, email);
  write(JOINED_KEY, JSON.stringify({ email, position }));
  window.dispatchEvent(new Event(CHANGED));
};

/** For useSyncExternalStore: re-reads on a join here or in another tab. */
export const subscribeJoined = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
};

export const readSavedEmail = () => read(EMAIL_KEY) ?? "";
export const readJoined = () => read(JOINED_KEY);
export const serverEmpty = () => "";
export const serverNull = () => null;

export const parseJoined = (raw: string | null): Joined | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Joined>;
    return typeof value.email === "string" ? { email: value.email, position: typeof value.position === "number" ? value.position : null, returning: true } : null;
  } catch {
    return null;
  }
};

/** The hero form's email field, which every "Join the waitlist" button on the page leads to. */
export const HERO_INPUT_ID = "waitlist-email";

/**
 * Takes the reader to the hero form and puts the cursor in its email field. Links keep `#join` as
 * their href, so without JavaScript they still land on the form.
 */
export const goToJoin = () => {
  const target = document.getElementById("join");
  if (!target) return false;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  window.setTimeout(() => document.getElementById(HERO_INPUT_ID)?.focus({ preventScroll: true }), smooth ? 450 : 0);
  return true;
};
