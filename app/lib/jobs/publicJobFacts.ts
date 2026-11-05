import type { PublicJobFacts, SalaryBand } from "@/types/jobMetadata";

/** Only the public backend contract belongs here; raw enrichment is never a display source. */
export function salaryLabel(band: SalaryBand): string | null {
  if (!band.currency || !band.period || (band.min === null && band.max === null)) return null;
  const number = (n: number) => new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(n);
  const amount = band.min !== null && band.max !== null && band.min !== band.max ? `${number(band.min)}–${number(band.max)}` : band.min !== null && band.max === null ? `From ${number(band.min)}` : band.max !== null && band.min === null ? `Up to ${number(band.max)}` : number(band.min ?? band.max!);
  const kind = band.kind === "ote" ? " OTE" : band.kind === "total" ? " total compensation" : "";
  return `${band.currency} ${amount}/${band.period}${kind}${band.conditions ? ` (${band.conditions})` : ""}`;
}
export function jobFactChips(facts: PublicJobFacts | null | undefined): {label:string; kind:"salary"|"visa"|"employment"; detail?:string}[] {
  if (!facts) return [];
  const chips: ReturnType<typeof jobFactChips> = [];
  const salaries = facts.salaryBands.flatMap(band => {const label=salaryLabel({...band,conditions:null});return label ? [{label,detail:salaryLabel(band) ?? undefined}] : [];});
  if (salaries.length === 1) chips.push({kind:"salary",...salaries[0]});
  else if (salaries.length > 1) chips.push({kind:"salary",label:"Multiple salary bands",detail:salaries.map(band=>band.detail).join("; ")});
  if (facts.visaSponsorship === "yes") chips.push({kind:"visa",label:"Visa sponsorship",detail:facts.sponsorshipConditions ?? undefined});
  else if (facts.visaSponsorship === "no") chips.push({kind:"visa",label:"No visa sponsorship",detail:facts.sponsorshipConditions ?? undefined});
  if (facts.employmentType) chips.push({kind:"employment",label:facts.employmentType.charAt(0).toUpperCase()+facts.employmentType.slice(1)});
  return chips;
}
export function jobLocations(facts: PublicJobFacts | null | undefined, legacy: string[] = []): string[] {
  if (facts?.worldwideEligible === true) return ["Worldwide"];
  const locations = facts ? [...facts.regions, ...facts.countries] : legacy;
  return [...new Set(locations)].length ? [...new Set(locations)] : [facts?.workLocation ?? "Location not specified"];
}
