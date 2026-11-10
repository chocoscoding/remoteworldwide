import type { PublicJobFacts, SalaryBand } from "@/types/jobMetadata";

const PERIOD_SHORT: Record<NonNullable<SalaryBand["period"]>, string> = {hour: "hr", day: "day", week: "wk", month: "mo", year: "yr"};

/** "$", "€", "CA$"; a code with no symbol ("NGN") gets a space before the number. */
function currencyPrefix(code: string): string {
  try {
    const symbol = new Intl.NumberFormat("en-US", {style: "currency", currency: code, currencyDisplay: "symbol"}).formatToParts(0).find(part => part.type === "currency")?.value ?? code;
    return /[A-Za-z]$/.test(symbol) ? `${symbol} ` : symbol;
  } catch {
    return `${code} `;
  }
}

/** Only the public backend contract belongs here; raw enrichment is never a display source. "$100 - 110/hr". */
export function salaryLabel(band: SalaryBand): string | null {
  if (!band.currency || !band.period || (band.min === null && band.max === null)) return null;
  const number = (n: number) => new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(n);
  const money = currencyPrefix(band.currency);
  const amount = band.min !== null && band.max !== null && band.min !== band.max ? `${money}${number(band.min)} - ${number(band.max)}` : band.min !== null && band.max === null ? `From ${money}${number(band.min)}` : band.max !== null && band.min === null ? `Up to ${money}${number(band.max)}` : `${money}${number(band.min ?? band.max!)}`;
  const kind = band.kind === "ote" ? " OTE" : band.kind === "total" ? " total compensation" : "";
  return `${amount}/${PERIOD_SHORT[band.period]}${kind}${band.conditions ? ` (${band.conditions})` : ""}`;
}
const PER_YEAR: Record<NonNullable<SalaryBand["period"]>, number> = {hour: 2080, day: 260, week: 52, month: 12, year: 1};
/** A band's top end as a yearly figure, so an hourly band and a yearly one can be compared. */
const yearlyTop = (band: SalaryBand): number => (band.max ?? band.min ?? 0) * (band.period ? PER_YEAR[band.period] : 1);

export function jobFactChips(facts: PublicJobFacts | null | undefined): {label:string; kind:"salary"|"visa"|"employment"; detail?:string}[] {
  // An employment type we could not work out is shown as full-time (owner, 2026-11-09).
  if (!facts) return [{kind:"employment",label:"Full-time"}];
  const chips: ReturnType<typeof jobFactChips> = [];
  const salaries = facts.salaryBands.flatMap(band => {const label=salaryLabel({...band,conditions:null});return label ? [{label,detail:salaryLabel(band) ?? undefined,top:yearlyTop(band)}] : [];});
  // Several bands (by city, by level): the chip shows the highest; hovering lists them all.
  if (salaries.length > 0) {
    const highest = salaries.reduce((best, band) => (band.top > best.top ? band : best));
    chips.push({kind:"salary",label:highest.label,detail:salaries.length === 1 ? highest.detail : salaries.map(band=>band.detail).join("; ")});
  }
  if (facts.visaSponsorship === "yes") chips.push({kind:"visa",label:"Visa sponsorship",detail:facts.sponsorshipConditions ?? undefined});
  else if (facts.visaSponsorship === "no") chips.push({kind:"visa",label:"No visa sponsorship",detail:facts.sponsorshipConditions ?? undefined});
  const employment = facts.employmentType ?? "full-time";
  chips.push({kind:"employment",label:employment.charAt(0).toUpperCase()+employment.slice(1)});
  return chips;
}
export function jobLocations(facts: PublicJobFacts | null | undefined, legacy: string[] = []): string[] {
  if (facts?.worldwideEligible === true) return ["Worldwide"];
  const locations = facts ? [...facts.regions, ...facts.countries] : legacy;
  return [...new Set(locations)].length ? [...new Set(locations)] : [facts?.workLocation ?? "Location not specified"];
}
