import { MousePointerClick } from "lucide-react";
import { FC } from "react";
import type { JobStats } from "@/types/main";

// How a listing is doing, under the admin's job actions. For now one number: how many times its
// "Apply Now" was pressed on the public job page (counted by the backend, admin presses left out).
const JobAnalytics: FC<{ stats: JobStats }> = ({ stats }) => {
  const last = stats.lastApplyClickAt ? new Date(stats.lastApplyClickAt) : null;
  return (
    <section aria-labelledby="job-analytics" className="br-plain mt-4 rounded-md bg-white p-4">
      <h2 id="job-analytics" className="text-sm font-bold uppercase tracking-wide text-black/55">
        Analytics
      </h2>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-4xl font-bold leading-none text-primary">{stats.applyClicks.toLocaleString("en-GB")}</p>
          <p className="mt-1.5 text-sm text-black/60">Apply clicks</p>
        </div>
        <MousePointerClick className="h-6 w-6 flex-none text-black/30" aria-hidden />
      </div>
      <p className="mt-3 border-t border-black/10 pt-2.5 text-xs text-black/55">
        {last
          ? `Last click: ${last.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
          : "No clicks yet"}
      </p>
    </section>
  );
};

export default JobAnalytics;
