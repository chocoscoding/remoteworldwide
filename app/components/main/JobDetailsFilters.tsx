"use client";
import { useFilter, type DetailFilterKey } from "@/provider/FilterProvider";
import { ROLES } from "@/app/lib/landing/catalogue";
const options: {
  key: DetailFilterKey;
  label: string;
  values: [string, string][];
}[] = [
  {
    key: "roleCategory",
    label: "Specialism",
    values: ROLES.map(([key, label]) => [key, label]),
  },
  {
    key: "employmentType",
    label: "Employment",
    values: [
      ["full-time", "Full-time"],
      ["part-time", "Part-time"],
      ["contract", "Contract"],
      ["freelance", "Freelance"],
      ["internship", "Internship"],
      ["temporary", "Temporary"],
    ],
  },
  {
    key: "visaSponsorship",
    label: "Visa sponsorship",
    values: [
      ["yes", "Offered for this role"],
      ["no", "Not offered"],
      ["unknown", "Not stated"],
    ],
  },
  {
    key: "visaType",
    label: "Visa type",
    values: [
      ["H1B", "H1B"],
      ["TN", "TN"],
      ["O1", "O1"],
      ["L1", "L1"],
      ["UK Skilled Worker", "UK Skilled Worker"],
      ["EU Blue Card", "EU Blue Card"],
      ["Canada LMIA", "Canada LMIA"],
    ],
  },
  {
    key: "countries",
    label: "Eligible country",
    values: [
      ["US", "United States"],
      ["GB", "United Kingdom"],
      ["CA", "Canada"],
      ["DE", "Germany"],
      ["FR", "France"],
      ["NG", "Nigeria"],
      ["IN", "India"],
      ["BR", "Brazil"],
      ["AU", "Australia"],
    ],
  },
  {
    key: "worldwide",
    label: "Worldwide eligibility",
    values: [["1", "Explicitly open worldwide"]],
  },
  {
    key: "status",
    label: "Listing status",
    values: [["archived", "Archived listings"]],
  },
];
export default function JobDetailsFilters() {
  const { detailFilters, setDetailFilter, setDetailFilters } = useFilter();
  return (
    <div className="space-y-3 border-t pt-4 mt-3">
      {options.map(({ key, label, values }) => (
        <label key={key} className="block text-sm font-medium">
          {label}
          <select
            aria-label={label}
            className="mt-1 w-full rounded-md border p-2 bg-white text-primary"
            value={detailFilters[key]}
            onChange={(e) => setDetailFilter(key, e.target.value)}
          >
            <option value="">
              {key === "status" ? "Open listings" : "Any"}
            </option>
            {values.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <form
        key={`${detailFilters.salaryMin}:${detailFilters.salaryCurrency}:${detailFilters.salaryPeriod}`}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setDetailFilters({
            salaryMin: String(data.get("salaryMin") ?? ""),
            salaryCurrency: String(data.get("salaryCurrency") ?? ""),
            salaryPeriod: String(data.get("salaryPeriod") ?? ""),
          });
        }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Minimum base salary</legend>
          <input
            name="salaryMin"
            required
            type="number"
            min="0"
            aria-label="Minimum salary"
            className="w-full rounded-md border p-2"
            placeholder="e.g. 100000"
            defaultValue={detailFilters.salaryMin}
          />
          <select
            name="salaryCurrency"
            required
            aria-label="Salary currency"
            className="w-full rounded-md border p-2 bg-white"
            defaultValue={detailFilters.salaryCurrency}
          >
            <option value="">Choose currency</option>
            {["USD", "GBP", "EUR", "CAD", "AUD", "NGN", "INR"].map(
              (currency) => (
                <option key={currency}>{currency}</option>
              ),
            )}
          </select>
          <select
            name="salaryPeriod"
            required
            aria-label="Salary period"
            className="w-full rounded-md border p-2 bg-white"
            defaultValue={detailFilters.salaryPeriod}
          >
            <option value="">Choose pay period</option>
            {["year", "month", "week", "day", "hour"].map((period) => (
              <option key={period} value={period}>
                Per {period}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Choose both currency and period. Only supported base-pay ranges are
            compared; bonuses and estimates are excluded.
          </p>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-primary text-white px-3 py-2 text-sm"
            >
              Apply salary
            </button>
            {detailFilters.salaryMin && (
              <button
                type="button"
                className="text-sm underline"
                onClick={() =>
                  setDetailFilters({
                    salaryMin: "",
                    salaryCurrency: "",
                    salaryPeriod: "",
                  })
                }
              >
                Clear salary
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
