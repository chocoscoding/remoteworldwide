"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";

interface Comparison {
  currency: string; period: string; lowerMedian: number; upperMedian: number; sampleSize: number;
  sources: Array<{ slug: string; postedAt: string }>;
}
interface Result { role: string; region: string | null; seniority: string | null; checkedAt: string; comparisons: Comparison[] }

export default function SalaryBenchmark({ role, onContext }: { role: string; onContext: (context: string) => void }) {
  const [region, setRegion] = useState("");
  const [seniority, setSeniority] = useState("");
  const [filters, setFilters] = useState({ region: "", seniority: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const result = useQuery({
    queryKey: ["prep", "salary-benchmark", role, filters],
    queryFn: ({ signal }) => apiGet<Result>(`/api/jobs/salary-benchmark?${new URLSearchParams({ role, ...filters })}`, signal),
    enabled: role.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
  return <div className="mt-4 border-t border-black/10 pt-4 text-sm">
    <h3 className="font-bold text-primary">RWW advertised salary comparison</h3>
    <p className="my-2 text-xs text-black/60">Exact role: {role}. Recent active listings from the last 180 days; one per employer, at least three employers per currency and pay period. These are advertised ranges, not accepted offers or a personal valuation. Unclear ranges are excluded.</p>
    <div className="flex flex-wrap gap-2">
      <input aria-label="Salary comparison region" placeholder="Region (optional)" maxLength={100} value={region} onChange={e => setRegion(e.target.value)} className="min-w-0 rounded border border-black/20 p-2" />
      <input aria-label="Salary comparison seniority" placeholder="Seniority (optional)" maxLength={100} value={seniority} onChange={e => setSeniority(e.target.value)} className="min-w-0 rounded border border-black/20 p-2" />
      <button type="button" className="rounded border border-primary px-3 py-2 font-bold" onClick={() => { setFilters({region:region.trim(), seniority:seniority.trim()}); setSelected(null); onContext(""); }}>Apply filters</button>
    </div>
    <p className="mt-2 text-xs text-black/60">Comparing {filters.region || "all regions"} · {filters.seniority || "all seniorities"}. Add filters before using this in practice if the broader comparison doesn’t fit.</p>
    {result.isPending && <p className="mt-3">Checking RWW listings…</p>}
    {result.isError && <p className="mt-3">Salary comparison unavailable. Your own figures can still ground practice.</p>}
    {result.data && !result.data.comparisons.length && <p className="mt-3">Not enough comparable salary data yet. No benchmark will be assumed.</p>}
    {result.data?.comparisons.map(item => {
      const key = `${item.currency}/${item.period}`;
      return <div key={key} className="mt-3 rounded-lg bg-black/5 p-3">
        <p className="font-bold">{item.currency} {item.lowerMedian.toLocaleString()}–{item.upperMedian.toLocaleString()} / {item.period}</p>
        <p className="text-xs text-black/60">Median advertised lower and upper bounds · {item.sampleSize} employers · checked {new Date(result.data!.checkedAt).toLocaleDateString()}</p>
        <details className="my-2 text-xs"><summary className="cursor-pointer">Source listings</summary><ul>{item.sources.map(source => <li key={source.slug}><a className="underline" href={`/jobs/${encodeURIComponent(source.slug)}`} target="_blank" rel="noreferrer">{source.slug}</a> · {new Date(source.postedAt).toLocaleDateString()}</li>)}</ul></details>
        <button type="button" className="font-bold text-primary underline" onClick={() => {
          setSelected(selected === key ? null : key);
          onContext(selected === key ? "" : `RWW advertised ranges for ${role.slice(0,120)}: median bounds ${item.currency} ${item.lowerMedian}-${item.upperMedian}/${item.period}, ${item.sampleSize} employers in the past 180 days; ${filters.region || "all regions"}, ${filters.seniority || "all seniorities"}. Advertised pay, not an offer guarantee.`);
        }}>{selected === key ? "Included in practice · remove" : "Use this comparison in practice"}</button>
      </div>;
    })}
  </div>;
}
