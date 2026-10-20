import { Eye, MousePointerClick, type LucideIcon } from "lucide-react";
import { FC } from "react";
import type { JobStats } from "@/types/main";

// How a listing is doing, under the admin's job actions: how many times its "Apply Now" was pressed
// and how many times its public page was seen (one view per visitor's tab). Both counted by the
// backend; the admin's own visits and presses are left out.

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

const Metric: FC<{ value: number; label: string; Icon: LucideIcon; last: string | null; lastLabel: string; none: string }> = ({
  value,
  label,
  Icon,
  last,
  lastLabel,
  none,
}) => (
  <div className="py-3 first:pt-0 last:pb-0">
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-4xl font-bold leading-none text-primary">{value.toLocaleString("en-GB")}</p>
        <p className="mt-1.5 text-sm text-black/60">{label}</p>
      </div>
      <Icon className="h-6 w-6 flex-none text-black/30" aria-hidden />
    </div>
    <p className="mt-2 text-xs text-black/55">{last ? `${lastLabel}: ${last}` : none}</p>
  </div>
);

const JobAnalytics: FC<{ stats: JobStats }> = ({ stats }) => (
  <section aria-labelledby="job-analytics" className="br-plain mt-4 rounded-md bg-white p-4">
    <h2 id="job-analytics" className="text-sm font-bold uppercase tracking-wide text-black/55">
      Analytics
    </h2>
    <div className="mt-3 divide-y divide-black/10">
      <Metric
        value={stats.applyClicks}
        label="Apply clicks"
        Icon={MousePointerClick}
        last={when(stats.lastApplyClickAt)}
        lastLabel="Last click"
        none="No clicks yet"
      />
      <Metric
        value={stats.impressions ?? 0}
        label="Impressions"
        Icon={Eye}
        last={when(stats.lastImpressionAt ?? null)}
        lastLabel="Last view"
        none="No views yet"
      />
    </div>
  </section>
);

export default JobAnalytics;
