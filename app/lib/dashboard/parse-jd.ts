// Job-posting reader for the log and apply flows.
//
// `parseJobUrl` runs the same `/api/job-imports` the job picker does: the
// backend reads the posting (a public ATS API where one exists, a crawl where
// it doesn't), extracts the fields, and caches the result across users, so a
// link someone already read costs nothing. It starts the import and then asks
// after it, rather than making one long request, because a rendered crawl plus
// extraction can outlive the 30-second limit on Next's rewrite proxy.
//
// The failure path is not an afterthought: §4 requires the flow never to
// dead-end, so `parseJobUrl` resolves to a discriminated result rather than
// throwing, and both callers fall through to manual fields on `ok: false`,
// showing `reason`. Wherever the backend said what went wrong, `reason` is its
// sentence, except where that sentence names a recovery only one caller has
// (see `failureReason`).
//
// A read, never a save. The picker saves every pick; these two flows keep what
// they read in their own state, exactly as they did with the mock.

import { apiMessage, shouldRetry } from "@/app/lib/api/core";
import { abandonJobImport, getJobImport, importPollDelay, isTerminalImportStatus, startJobImport } from "@/app/lib/jobs/api";
import type { JobImportItem } from "@/app/lib/jobs/types";

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

/**
 * How long to keep asking. The backend already reports an import still running
 * past its stale window (90 s by default) as `failed` with `timeout`, and that
 * answer carries its own copy, so this sits just beyond it: it only decides the
 * outcome when polling itself never got that far.
 */
const PARSE_DEADLINE_MS = 100_000;

const TIMEOUT_REASON = "That page took too long to load. Fill it in below instead.";
const FAILED_REASON = "We couldn't read that posting. Fill it in below and we'll save it anyway.";
const CANCELLED_REASON = "Reading that link was cancelled. Fill it in below instead.";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `looksLikeUrl` accepts a bare "jobs.lever.co/acme/123", which is what people
 * copy out of an address bar, but the import reads only http(s) links and
 * would refuse it as invalid. It gets the scheme a browser would have added,
 * as the mock this replaced did.
 */
function withScheme(input: string): string {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

/** The host a link points at, for copy: "linkedin.com". */
function siteOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./i, "");
  } catch {
    return "that site";
  }
}

/**
 * Why a read failed, in words both callers can act on.
 *
 * Usually the backend's own sentence. Not for the codes whose sentence sends
 * the user to paste the posting's text: the apply wizard has a paste tab for
 * that, but the log dialog shows the reason above Company, Role and Location
 * with no box for text, and a posting pasted into its one input goes through
 * `parseFreeText`, which splits the prose into a company and a role. Both
 * callers put fields to fill in below the reason, so these point there.
 */
function failureReason(item: JobImportItem, link: string): string {
  switch (item.error?.code) {
    case "target-blocked":
      return `We can't read postings on ${siteOf(link)}. Fill it in below instead.`;
    case "limited":
      return "You've read a lot of links for now. Fill it in below, or try the link again later.";
    case "paused":
      return "Reading links is paused for today. Fill it in below instead.";
    default:
      return item.error?.message || FAILED_REASON;
  }
}

/** A settled import, as the result both callers already handle. */
function toParseResult(item: JobImportItem, link: string): ParseResult {
  if (item.status === "failed") return { ok: false, reason: failureReason(item, link) };
  // Only this user can abandon their import, and the picker dedupes onto the
  // same row for the same link, so a Cancel there ends this read too.
  if (item.status === "abandoned") return { ok: false, reason: CANCELLED_REASON };
  if (!item.draft) return { ok: false, reason: FAILED_REASON };

  const { company, role, location, description } = item.draft;
  const companyName = company?.trim() ?? "";
  const roleName = role?.trim() ?? "";
  // Both callers read `ok: true` as "company and role are known" and start from
  // them as-is (the apply wizard has no field to correct them in), so a posting
  // missing either is a failure that says what to add. The mock drew the same line.
  if (!companyName && !roleName) {
    return { ok: false, reason: "We read that posting but couldn't find the company or the role. Add them below." };
  }
  if (!companyName) return { ok: false, reason: "We read that posting but couldn't find the company. Add it below." };
  if (!roleName) return { ok: false, reason: "We read that posting but couldn't find the role. Add it below." };

  const parsed: ParsedJob = { company: companyName, role: roleName };
  if (location) parsed.location = location;
  if (description) parsed.jdText = description;
  return { ok: true, parsed };
}

/**
 * Read a job posting from its link: start an import, then poll it until it
 * settles. Never rejects. Every failure, the requests themselves included,
 * resolves `{ ok: false, reason }` with a sentence the caller can show.
 */
export async function parseJobUrl(url: string): Promise<ParseResult> {
  const link = withScheme(url.trim());
  let importId: string;
  try {
    ({ importId } = await startJobImport({ url: link }));
  } catch (error) {
    return { ok: false, reason: apiMessage(error) };
  }

  const deadline = Date.now() + PARSE_DEADLINE_MS;
  let answers = 0;
  let failures = 0;
  while (Date.now() < deadline) {
    await sleep(importPollDelay(answers));
    let item: JobImportItem;
    try {
      item = await getJobImport(importId);
    } catch (error) {
      // A network or server blip is asked again on the same cadence. A 4xx
      // (the import expired, or the session did) won't fix itself by asking.
      failures += 1;
      if (shouldRetry(failures, error)) continue;
      return { ok: false, reason: apiMessage(error) };
    }
    failures = 0;
    answers += 1;
    if (isTerminalImportStatus(item.status)) return toParseResult(item, link);
  }

  // Nobody is waiting any more. Abandoning saves nothing already spent, but the
  // backend still caches a late result for the next person, so it's worth the
  // call; a failure here changes nothing for this user.
  abandonJobImport(importId).catch(() => undefined);
  return { ok: false, reason: TIMEOUT_REASON };
}
