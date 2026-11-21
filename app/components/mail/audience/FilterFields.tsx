"use client";

import { useState, type FC, type ReactNode } from "react";
import { ENGAGEMENT_LABELS, ENGAGEMENT_LEVELS, PLAN_KEYS, type AudienceFilter, type EngagementLevel } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { ChipPicker, INPUT_SM, Segmented } from "../ui";
import { numOrUndef } from "../format";
import ListInput from "../ListInput";
import type { FilterContext, FilterId } from "./filterText";

const PLAN_OPTIONS = PLAN_KEYS.map((p) => ({ value: p as string, label: p[0].toUpperCase() + p.slice(1) }));
const LEVEL_OPTIONS = ENGAGEMENT_LEVELS.map((l) => ({ value: l, label: ENGAGEMENT_LABELS[l] }));

type Props = { filter: AudienceFilter; set: (patch: Partial<AudienceFilter>) => void; ctx: FilterContext };

/** A whole number of 0 or more, or nothing. */
const Num: FC<{ value: number | undefined; onChange: (value: number | undefined) => void; label: string; placeholder?: string }> = ({ value, onChange, label, placeholder }) => (
  <input
    type="number"
    min={0}
    step={1}
    inputMode="numeric"
    aria-label={label}
    placeholder={placeholder}
    className={cn(INPUT_SM, "w-16 tabular-nums")}
    value={value ?? ""}
    onChange={(e) => {
      const v = numOrUndef(e.target.value);
      onChange(v === undefined ? undefined : Math.max(0, Math.floor(v)));
    }}
  />
);

/** A sentence with fields in it: "In the last [30] days". */
const Line: FC<{ children: ReactNode }> = ({ children }) => <p className="flex flex-wrap items-center gap-1.5 text-sm">{children}</p>;

type SinceMode = "last" | "over" | "between";
const SINCE_OPTIONS: ReadonlyArray<{ value: SinceMode; label: string }> = [
  { value: "last", label: "In the last" },
  { value: "over", label: "More than" },
  { value: "between", label: "Between" },
];

/** Signed up (or joined): in the last N days, more than N days ago, or between the two. */
const SinceFields: FC<Props> = ({ filter, set }) => {
  const within = filter.signedUpWithinDays;
  const before = filter.signedUpBeforeDays;
  const [mode, setMode] = useState<SinceMode>(() => (within !== undefined && before !== undefined ? "between" : before !== undefined ? "over" : "last"));
  const choose = (next: SinceMode) => {
    setMode(next);
    if (next === "last") set({ signedUpWithinDays: within ?? before, signedUpBeforeDays: undefined });
    else if (next === "over") set({ signedUpBeforeDays: before ?? within, signedUpWithinDays: undefined });
  };
  return (
    <div className="flex flex-col gap-2.5">
      <Segmented label="When" value={mode} options={SINCE_OPTIONS} onChange={choose} />
      {mode === "last" ? (
        <Line>
          In the last <Num label="Days" value={within} onChange={(v) => set({ signedUpWithinDays: v })} /> days
        </Line>
      ) : mode === "over" ? (
        <Line>
          More than <Num label="Days ago" value={before} onChange={(v) => set({ signedUpBeforeDays: v })} /> days ago
        </Line>
      ) : (
        <Line>
          Between <Num label="From, days ago" value={before} onChange={(v) => set({ signedUpBeforeDays: v })} /> and{" "}
          <Num label="To, days ago" value={within} onChange={(v) => set({ signedUpWithinDays: v })} /> days ago
        </Line>
      )}
    </div>
  );
};

/** The popover body for one filter chip. */
const FilterFields: FC<Props & { id: FilterId }> = ({ id, filter, set, ctx }) => {
  switch (id) {
    case "plan":
      return <ChipPicker label="Plans" values={filter.plans ?? []} options={PLAN_OPTIONS} onChange={(v) => set({ plans: v })} />;
    case "signedUp":
      return <SinceFields filter={filter} set={set} ctx={ctx} />;
    case "active":
      return (
        <Line>
          Active in the last <Num label="Days" value={filter.activeWithinDays} onChange={(v) => set({ activeWithinDays: v })} /> days
        </Line>
      );
    case "away":
      return (
        <Line>
          No visit for <Num label="Days" value={filter.inactiveForDays} onChange={(v) => set({ inactiveForDays: v })} /> days or more
        </Line>
      );
    case "resume":
      return (
        <Segmented
          label="Resume"
          value={filter.hasResume === false ? "no" : "yes"}
          options={[
            { value: "yes", label: "Has a resume" },
            { value: "no", label: "No resume" },
          ]}
          onChange={(v) => set({ hasResume: v === "yes" })}
        />
      );
    case "applications":
      return (
        <Line>
          From <Num label="At least" placeholder="any" value={filter.minApplications} onChange={(v) => set({ minApplications: v })} /> to{" "}
          <Num label="At most" placeholder="any" value={filter.maxApplications} onChange={(v) => set({ maxApplications: v })} /> applications
        </Line>
      );
    case "credits":
      return (
        <Line>
          <Num label="Credits at most" value={filter.creditsAtMost} onChange={(v) => set({ creditsAtMost: v })} /> credits or fewer
        </Line>
      );
    case "engagement":
      return <ChipPicker<EngagementLevel> label="Engagement" values={filter.engagement ?? []} options={LEVEL_OPTIONS} onChange={(v) => set({ engagement: v })} />;
    case "clicked":
      return ctx.campaigns.length ? (
        <div role="radiogroup" aria-label="Campaign" className="-mx-1 flex max-h-60 min-w-56 flex-col overflow-y-auto">
          {ctx.campaigns.map((c) => {
            const on = filter.clickedCampaignId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ clickedCampaignId: c.id })}
                className={cn("truncate rounded px-2 py-1.5 text-left text-sm", on ? "bg-black font-semibold text-[#e1f073]" : "text-gray-700 hover:bg-gray-50 hover:text-black")}>
                {c.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No sent campaigns yet.</p>
      );
    case "tag":
      return <ListInput label="Mail tags, comma separated" className={cn(INPUT_SM, "w-60")} value={filter.mailTags} onChange={(v) => set({ mailTags: v })} placeholder="unhappy, vip" />;
    case "source":
      return (
        <ListInput
          label="Sources, comma separated"
          className={cn(INPUT_SM, "w-60")}
          value={filter.subscriberSources}
          onChange={(v) => set({ subscriberSources: v })}
          placeholder="resume-guide, salary-report"
        />
      );
    case "neverOpened":
      return null;
  }
};

export default FilterFields;
