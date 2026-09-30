// The countries behind a job's region labels, for Google's JobPosting markup.
//
// A fully remote posting only shows in Google's job search when it names at least
// one country applicants may work from (`applicantLocationRequirements`), and the
// site stores regions ("EMEA", "LATAM", "Anywhere in the world") rather than
// countries. This expands each region label into the countries it covers.
//
// Cuba, Iran, North Korea, Russia, Belarus and Syria are left out of every list:
// sanctions keep most employers from hiring there, so no region or "worldwide"
// posting should advertise them.

const EUROPE = [
  "Albania", "Andorra", "Austria", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czechia",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo",
  "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands",
  "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain",
  "Sweden", "Switzerland", "Ukraine", "United Kingdom",
];

const MIDDLE_EAST = [
  "Bahrain", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Turkey",
  "United Arab Emirates", "Yemen",
];

const AFRICA = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", "Central African Republic",
  "Chad", "Comoros", "Democratic Republic of the Congo", "Republic of the Congo", "Cote d'Ivoire", "Djibouti", "Egypt",
  "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya",
  "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique",
  "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
  "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];

const EAST_ASIA = ["China", "Hong Kong", "Japan", "Macau", "Mongolia", "South Korea", "Taiwan"];
const SOUTHEAST_ASIA = [
  "Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines", "Singapore", "Thailand", "Timor-Leste",
  "Vietnam",
];
const SOUTH_ASIA = ["Afghanistan", "Bangladesh", "Bhutan", "India", "Maldives", "Nepal", "Pakistan", "Sri Lanka"];
const CENTRAL_ASIA = ["Armenia", "Azerbaijan", "Georgia", "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Uzbekistan"];
const OCEANIA = [
  "Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "New Zealand", "Palau", "Papua New Guinea",
  "Samoa", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu",
];

const NORTH_AMERICA = ["United States", "Canada"];
const SOUTH_AMERICA = [
  "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay",
  "Venezuela",
];
const CENTRAL_AMERICA = ["Mexico", "Belize", "Costa Rica", "El Salvador", "Guatemala", "Honduras", "Nicaragua", "Panama"];
const CARIBBEAN = [
  "Antigua and Barbuda", "Bahamas", "Barbados", "Dominica", "Dominican Republic", "Grenada", "Haiti", "Jamaica",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Trinidad and Tobago",
];

const ASIA = [...EAST_ASIA, ...SOUTHEAST_ASIA, ...SOUTH_ASIA, ...CENTRAL_ASIA, ...MIDDLE_EAST];
const APAC = [...EAST_ASIA, ...SOUTHEAST_ASIA, ...SOUTH_ASIA, ...OCEANIA];
const LATAM = [...CENTRAL_AMERICA, ...SOUTH_AMERICA, "Dominican Republic", "Haiti"];
const AMERICAS = [...NORTH_AMERICA, ...CENTRAL_AMERICA, ...SOUTH_AMERICA, ...CARIBBEAN];
const EMEA = [...EUROPE, ...MIDDLE_EAST, ...AFRICA];
const WORLD = [...EMEA, ...ASIA, ...OCEANIA, ...AMERICAS];

// Keyed by the lower-cased label as stored on a job (see the Region table), plus common spellings.
const REGION_COUNTRIES: Record<string, readonly string[]> = {
  "anywhere in the world": WORLD,
  worldwide: WORLD,
  anywhere: WORLD,
  emea: EMEA,
  europe: EUROPE,
  africa: AFRICA,
  asia: ASIA,
  apac: APAC,
  australia: ["Australia"],
  latam: LATAM,
  "latin america": LATAM,
  "south america": SOUTH_AMERICA,
  americas: AMERICAS,
  amer: AMERICAS,
  namer: NORTH_AMERICA,
  "north america": NORTH_AMERICA,
  usa: ["United States"],
  us: ["United States"],
  "united states": ["United States"],
  canada: ["Canada"],
  uk: ["United Kingdom"],
  "united kingdom": ["United Kingdom"],
};

/**
 * The countries a job's applicants may work from. No regions (or only blank ones)
 * means the job is open anywhere, as the job tile says. A label this file doesn't know is passed
 * through as a country name, so a job tagged "Germany" still names Germany.
 */
export function applicantCountries(regions: readonly string[]): string[] {
  const countries = new Set<string>();
  for (const region of regions.length ? regions : ["Anywhere in the world"]) {
    const label = region.trim();
    if (!label) continue;
    const known = REGION_COUNTRIES[label.toLowerCase()];
    if (known) known.forEach((country) => countries.add(country));
    else countries.add(label);
  }
  return countries.size ? [...countries] : [...WORLD];
}
