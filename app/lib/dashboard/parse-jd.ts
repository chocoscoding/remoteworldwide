// Job-posting parser for the log flow.
//
// MOCK. The real thing already exists on the Express backend as
// `POST /api/jobs/parse` (ScrapingAnt scrape -> Groq AI parse), but this build
// is deliberately UI-only with no backend calls, so this module fakes the same
// shape and timing. Swapping to the real endpoint later is a single fetch in
// `parseJobUrl` — the return type is already what that route produces.
//
// The failure path is not an afterthought: §4 requires the flow never to
// dead-end, so `parseJobUrl` resolves to a discriminated result rather than
// throwing, and the dialog falls through to manual fields on `ok: false`.

export interface ParsedJob {
  company: string;
  role: string;
  location?: string;
  jdText?: string;
}

export type ParseResult = { ok: true; parsed: ParsedJob } | { ok: false; reason: string };

/** Anything that looks like a URL takes the parse path; everything else is free text. */
export function looksLikeUrl(input: string): boolean {
  const s = input.trim();
  if (/\s/.test(s)) return false;
  return /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+\//.test(s);
}

/**
 * Free-text fallback: "Stripe — Support Engineer" or "Stripe - Support Engineer"
 * splits on the dash; anything else is treated as the company with an empty role
 * so the user can fill the rest in.
 */
export function parseFreeText(input: string): ParsedJob {
  const s = input.trim();
  const m = s.split(/\s+[—–-]\s+/);
  if (m.length >= 2) return { company: m[0].trim(), role: m.slice(1).join(" - ").trim() };
  return { company: s, role: "" };
}

/** Known hosts we pretend to recognise, so the demo produces plausible output. */
const HOST_COMPANY: Record<string, string> = {
  "boards.greenhouse.io": "Greenhouse-hosted role",
  "jobs.lever.co": "Lever-hosted role",
  "linkedin.com": "LinkedIn posting",
  "stripe.com": "Stripe",
  "vercel.com": "Vercel",
  "linear.app": "Linear",
  "deel.com": "Deel",
};

const SAMPLE_JD =
  "We are looking for a senior product designer to own end-to-end flows across our core product. " +
  "You will partner with engineering and research, run discovery, and ship iteratively. " +
  "Requirements: 5+ years in product design, strong systems thinking, experience with design systems, " +
  "comfort with ambiguity, and a portfolio showing measurable outcomes.";

function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/**
 * Simulates the scrape+parse round trip. Deterministically fails on URLs
 * containing "noparse" so the fallback path is testable without waiting for a
 * random miss, and fails on anything unparseable.
 */
export async function parseJobUrl(url: string, delayMs = 900): Promise<ParseResult> {
  await new Promise((r) => setTimeout(r, delayMs));

  if (url.includes("noparse")) {
    return { ok: false, reason: "We couldn't read that posting. Fill it in below and we'll save it anyway." };
  }

  let host = "";
  let path = "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    return { ok: false, reason: "That doesn't look like a link we can open. Fill it in below instead." };
  }

  const known = Object.entries(HOST_COMPANY).find(([h]) => host.endsWith(h));
  const company = known ? known[1] : titleCase(host.split(".")[0]);

  // Pull the last meaningful path segment as the role guess.
  const segments = path.split("/").filter((s) => s && !/^\d+$/.test(s));
  const roleGuess = segments.length ? titleCase(segments[segments.length - 1]) : "";

  if (!roleGuess) {
    return { ok: false, reason: "We found the company but not the role. Add it below and we'll save it." };
  }

  return { ok: true, parsed: { company, role: roleGuess, location: "Remote", jdText: SAMPLE_JD } };
}
