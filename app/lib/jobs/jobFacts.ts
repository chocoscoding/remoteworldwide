// Employment type and salary for a job's JobPosting markup (Google's "employmentType" and
// "baseSalary"). The Job table stores neither, so they are read at render time, best source first:
//
//  1. The posting's own ATS. Most of the board links to Greenhouse, Lever or Ashby, whose public
//     job APIs state both as data. Read the same way @rww/scrape (Greenhouse, Lever) and the
//     backend's ashbyPosting.ts (Ashby) read them for job imports.
//  2. The posting's own words: "full-time", "contract role", "Salary: $80k–$120k USD".
//  3. Employment type only: FULL_TIME, which is what every job tile on the board already shows.
//
// Salary is never guessed: no ATS figure and no clearly labelled range in the text means no
// baseSalary (Google lists it as recommended, not required). Every failure here is quiet: the
// page renders with what it has, and a slow ATS can't hold it up past TIMEOUT_MS.

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "TEMPORARY" | "INTERN";
export type SalaryPeriod = "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
export type Salary = { min: number | null; max: number | null; currency: string; period: SalaryPeriod };
export type JobFacts = { employmentType: EmploymentType; salary: Salary | null };

type AtsFacts = { employmentType: EmploymentType | null; salary: Salary | null };

const TIMEOUT_MS = 4000;
/** An ATS answer is good for a day; the job page itself regenerates every 12 hours. */
const ATS_REVALIDATE_S = 86_400;
const DIGITS = /^\d{1,20}$/;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function jobFacts(job: { applicationUrl: string; title: string; description: string }): Promise<JobFacts> {
  const ats = await fromAts(job.applicationUrl).catch(() => null);
  const text = htmlToText(job.description);
  return {
    employmentType: ats?.employmentType ?? employmentTypeFromText(job.title, text) ?? "FULL_TIME",
    salary: ats?.salary ?? salaryFromText(text),
  };
}

// ---------------------------------------------------------------------------
// The ATS
// ---------------------------------------------------------------------------

async function fromAts(applicationUrl: string): Promise<AtsFacts | null> {
  let url: URL;
  try {
    url = new URL(applicationUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const [org, second, third] = url.pathname.split("/").filter(Boolean);
  if (!org || !SLUG.test(org)) return null;

  // job-boards.greenhouse.io/{board}/jobs/{id}, and the EU board's twin.
  if (/^(job-)?boards(\.eu)?\.greenhouse\.io$/.test(host) && second === "jobs" && third && DIGITS.test(third)) {
    const api = host.includes(".eu.") ? "boards-api.eu.greenhouse.io" : "boards-api.greenhouse.io";
    const data = await getJson(`https://${api}/v1/boards/${encodeURIComponent(org)}/jobs/${third}?pay_transparency=true`);
    return isRecord(data) ? { employmentType: greenhouseType(data.metadata), salary: greenhouseSalary(data.pay_input_ranges) } : null;
  }
  // jobs.lever.co/{company}/{posting}[/apply]
  if ((host === "jobs.lever.co" || host === "jobs.eu.lever.co") && second && UUID.test(second)) {
    const api = host === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co";
    const data = await getJson(`https://${api}/v0/postings/${encodeURIComponent(org)}/${second.toLowerCase()}`);
    if (!isRecord(data)) return null;
    const categories = isRecord(data.categories) ? data.categories : {};
    const range = isRecord(data.salaryRange) ? data.salaryRange : null;
    return {
      employmentType: typeFromWords(str(categories.commitment)),
      salary: range ? salaryOf(num(range.min), num(range.max), range.currency, periodFrom(str(range.interval))) : null,
    };
  }
  // jobs.ashbyhq.com/{org}/{posting}[/application]
  if (host === "jobs.ashbyhq.com" && second && UUID.test(second)) {
    const board = await ashbyBoard(org);
    return board?.get(second.toLowerCase()) ?? null;
  }
  return null;
}

async function getJson(endpoint: string): Promise<unknown> {
  const res = await fetch(endpoint, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: ATS_REVALIDATE_S },
  });
  return res.ok ? res.json() : null;
}

/**
 * Ashby has no single-posting endpoint: its board API lists every posting, descriptions and all,
 * which runs to megabytes for a big company (too big for the fetch cache). So each board is read
 * once and only the two facts per posting are kept, here, for ATS_REVALIDATE_S.
 */
const ashbyBoards = new Map<string, { at: number; facts: Promise<Map<string, AtsFacts> | null> }>();

function ashbyBoard(org: string): Promise<Map<string, AtsFacts> | null> {
  const key = org.toLowerCase();
  const cached = ashbyBoards.get(key);
  if (cached && Date.now() - cached.at < ATS_REVALIDATE_S * 1000) return cached.facts;
  const facts = readAshbyBoard(org);
  ashbyBoards.set(key, { at: Date.now(), facts });
  // A failed read isn't kept: the next page to ask tries again.
  facts.then((value) => {
    if (!value) ashbyBoards.delete(key);
  });
  return facts;
}

async function readAshbyBoard(org: string): Promise<Map<string, AtsFacts> | null> {
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const jobs = isRecord(data) && Array.isArray(data.jobs) ? data.jobs : [];
    const facts = new Map<string, AtsFacts>();
    for (const job of jobs) {
      if (!isRecord(job)) continue;
      const id = str(job.id)?.toLowerCase();
      if (!id) continue;
      facts.set(id, {
        employmentType: ASHBY_TYPES[str(job.employmentType) ?? ""] ?? null,
        salary: job.shouldDisplayCompensationOnJobPostings === false ? null : ashbySalary(job.compensation),
      });
    }
    return facts;
  } catch {
    return null;
  }
}

const ASHBY_TYPES: Record<string, EmploymentType> = {
  FullTime: "FULL_TIME",
  PartTime: "PART_TIME",
  Intern: "INTERN",
  Contract: "CONTRACTOR",
  Temporary: "TEMPORARY",
};

function ashbySalary(compensation: unknown): Salary | null {
  if (!isRecord(compensation) || !Array.isArray(compensation.summaryComponents)) return null;
  for (const component of compensation.summaryComponents) {
    if (!isRecord(component) || str(component.compensationType) !== "Salary") continue;
    const interval = /^\s*1\s+([A-Z]+)\s*$/i.exec(str(component.interval) ?? "")?.[1];
    const salary = salaryOf(num(component.minValue), num(component.maxValue), component.currencyCode, periodFrom(interval ?? null));
    if (salary) return salary;
  }
  return null;
}

/** Not a Greenhouse field; some boards add it as custom metadata ("Employment Type", "Commitment"). */
function greenhouseType(metadata: unknown): EmploymentType | null {
  if (!Array.isArray(metadata)) return null;
  for (const entry of metadata) {
    if (!isRecord(entry)) continue;
    const name = str(entry.name);
    if (name && /\b(?:employment|job|time|contract) type\b|\bcommitment\b/i.test(name)) {
      const type = typeFromWords(typeof entry.value === "string" ? entry.value : Array.isArray(entry.value) ? entry.value.join(" ") : null);
      if (type) return type;
    }
  }
  return null;
}

/** The first usable range wins: boards with several list them per location, most general first. */
function greenhouseSalary(ranges: unknown): Salary | null {
  if (!Array.isArray(ranges)) return null;
  for (const range of ranges) {
    if (!isRecord(range)) continue;
    const min = num(range.min_cents);
    const max = num(range.max_cents);
    const salary = salaryOf(min === null ? null : min / 100, max === null ? null : max / 100, range.currency_type, periodFrom(str(range.title)));
    if (salary) return salary;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The posting's words
// ---------------------------------------------------------------------------

/** An ATS's own label ("Full-time", "Contract"), mapped to Google's values. */
function typeFromWords(words: string | null): EmploymentType | null {
  if (!words) return null;
  if (/\bintern(?:ship)?\b/i.test(words)) return "INTERN";
  if (/\bpart[\s-]?time\b/i.test(words)) return "PART_TIME";
  if (/\b(?:contract(?:or)?|freelance)\b/i.test(words)) return "CONTRACTOR";
  if (/\btemp(?:orary)?\b/i.test(words)) return "TEMPORARY";
  if (/\bfull[\s-]?time\b|\bpermanent\b/i.test(words)) return "FULL_TIME";
  return null;
}

/**
 * Only phrases that can't mean anything else: "contract" alone also means a smart contract or a
 * customer's contract, and "intern" is the start of "internal". The title is read first.
 */
const TEXT_TYPES: [RegExp, EmploymentType][] = [
  [/\b(?:internship|intern\s+(?:role|position|program(?:me)?))\b/i, "INTERN"],
  [/\bpart[\s-]time\b/i, "PART_TIME"],
  [/\b(?:freelance|freelancer|independent contractor|contract[\s-]to[\s-]hire|contractor\s+(?:role|position|basis)|contract\s+(?:role|position|basis|opportunity|engagement|job)|on\s+a\s+contract(?:\s+basis)?|\d+[\s-]month\s+contract)\b/i, "CONTRACTOR"],
  [/\btemporary\s+(?:role|position|contract|assignment)\b/i, "TEMPORARY"],
  [/\bfull[\s-]time\b/i, "FULL_TIME"],
];

export function employmentTypeFromText(title: string, text: string): EmploymentType | null {
  for (const source of [title, text]) {
    for (const [pattern, type] of TEXT_TYPES) if (pattern.test(source)) return type;
  }
  return null;
}

const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP" };
const AMOUNT = String.raw`(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)\s?([kK])?`;
/** "$80k–$120k USD", "USD 90,000 - 110,000", "€60.000 to €75.000". */
const RANGE = new RegExp(
  String.raw`(?:\b(USD|EUR|GBP|CAD|AUD)\s?)?([$€£])?\s?${AMOUNT}\s?(?:-|–|—|to)\s?(?:US)?[$€£]?\s?${AMOUNT}(?:\s?(USD|EUR|GBP|CAD|AUD)\b)?`,
  "g",
);
/** A range only counts when the words just before it say it's pay. */
const PAY_WORDS = /\b(?:salary|pay\s+(?:range|band|scale)|base\s+pay|compensation|comp\s+range|OTE|on[\s-]target\s+earnings|hourly\s+rate|day\s+rate|rate)\b/i;

export function salaryFromText(text: string): Salary | null {
  for (const match of text.matchAll(RANGE)) {
    const [whole, codeBefore, symbol, lo, loK, hi, hiK, codeAfter] = match;
    const currency = (codeBefore ?? codeAfter)?.toUpperCase() ?? (symbol ? SYMBOLS[symbol] : undefined);
    if (!currency) continue;
    const before = text.slice(Math.max(0, (match.index ?? 0) - 100), match.index);
    if (!PAY_WORDS.test(before)) continue;
    const after = text.slice((match.index ?? 0) + whole.length, (match.index ?? 0) + whole.length + 40);
    const k = loK || hiK ? 1000 : 1;
    const min = amount(lo) * (loK ? 1000 : k);
    const max = amount(hi) * (hiK ? 1000 : k);
    const period = periodFrom(after) ?? (min >= 10_000 ? "YEAR" : null);
    if (!period) continue;
    const salary = salaryOf(min, max, currency, period);
    if (salary && plausible(salary)) return salary;
  }
  return null;
}

/** "80,000", "80.000" and "80 000" are eighty thousand; "80.5" is eighty and a half. */
function amount(raw: string): number {
  return /^\d{1,3}(?:[,.\s]\d{3})+$/.test(raw) ? Number(raw.replace(/[,.\s]/g, "")) : Number(raw);
}

const LIMITS: Record<SalaryPeriod, [number, number]> = {
  HOUR: [5, 1_000],
  DAY: [40, 5_000],
  WEEK: [200, 25_000],
  MONTH: [500, 100_000],
  YEAR: [10_000, 2_000_000],
};
function plausible(salary: Salary): boolean {
  const [lo, hi] = LIMITS[salary.period];
  return [salary.min, salary.max].every((v) => v === null || (v >= lo && v <= hi));
}

// ---------------------------------------------------------------------------
// Defensive readers: nothing from an external API is trusted to match its documented shape.
// ---------------------------------------------------------------------------

function periodFrom(text: string | null): SalaryPeriod | null {
  if (!text) return null;
  if (/\b(?:hour(?:ly)?|hr)\b|per-hour/i.test(text)) return "HOUR";
  if (/\bda(?:y|ily)\b|per-day/i.test(text)) return "DAY";
  if (/\bweek(?:ly)?\b|per-week/i.test(text)) return "WEEK";
  if (/\bmonth(?:ly)?\b|per-month/i.test(text)) return "MONTH";
  if (/\b(?:year(?:ly)?|annual(?:ly)?|annum|yr)\b|per-year/i.test(text)) return "YEAR";
  return null;
}

/**
 * Positive numbers, a range that runs the right way, and a currency. A figure with no period is
 * read as yearly only when it's big enough to be one; otherwise there is no salary to report.
 */
function salaryOf(min: number | null, max: number | null, currency: unknown, period: SalaryPeriod | null): Salary | null {
  const lo = min !== null && min > 0 ? min : null;
  const hi = max !== null && max > 0 ? max : null;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null && lo > hi) return null;
  const code = str(currency);
  if (!code || !/^[A-Za-z]{3}$/.test(code)) return null;
  const resolved = period ?? ((lo ?? hi ?? 0) >= 10_000 ? "YEAR" : null);
  return resolved ? { min: lo, max: hi, currency: code.toUpperCase(), period: resolved } : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
