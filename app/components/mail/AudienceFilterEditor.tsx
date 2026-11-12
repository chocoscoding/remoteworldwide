"use client";

import type { ChangeEvent, FC, ReactNode } from "react";
import { ENGAGEMENT_LABELS, ENGAGEMENT_LEVELS, PLAN_KEYS, type AudienceFilter, type EngagementLevel } from "@/app/lib/mail/types";
import { ChipPicker, Field, INPUT, Segmented } from "./ui";
import { numOrUndef } from "./format";
import ListInput from "./ListInput";

const PLAN_OPTIONS = PLAN_KEYS.map((p) => ({ value: p as string, label: p[0].toUpperCase() + p.slice(1) }));
const LEVEL_OPTIONS = ENGAGEMENT_LEVELS.map((l) => ({ value: l, label: ENGAGEMENT_LABELS[l] }));

/** The AudienceFilter builder (MAIL-BUILD-SPEC section 3). Pref, suppression and verification apply on top, always. */
const AudienceFilterEditor: FC<{
  filter: AudienceFilter;
  onChange: (filter: AudienceFilter) => void;
  campaigns: Array<{ id: string; name: string }>;
}> = ({ filter, onChange, campaigns }) => {
  const set = <K extends keyof AudienceFilter>(key: K, value: AudienceFilter[K]) => onChange({ ...filter, [key]: value });
  const num = (key: keyof AudienceFilter) => ({
    type: "number" as const,
    min: 0,
    className: INPUT,
    value: (filter[key] as number | undefined) ?? "",
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(key, numOrUndef(e.target.value) as never),
  });
  const users = filter.kind === "users";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Who"
          value={filter.kind}
          onChange={(kind) => onChange({ kind })}
          options={[
            { value: "users", label: "Accounts" },
            { value: "subscribers", label: "Subscribers (no account)" },
          ]}
        />
        <span className="text-xs text-gray-500">Always on top: has an email, not suppressed, the mail&apos;s pref on{users ? ", verified, not being deleted" : ""}.</span>
      </div>

      {users ? (
        <Group title="Plan and account">
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-semibold text-gray-600">Plans (none = any)</p>
            <ChipPicker label="Plans" values={filter.plans ?? []} options={PLAN_OPTIONS} onChange={(v) => set("plans", v)} />
          </div>
          <Field label="Signed up within, days">
            <input {...num("signedUpWithinDays")} />
          </Field>
          <Field label="Signed up more than, days ago">
            <input {...num("signedUpBeforeDays")} />
          </Field>
          <Field label="Active within, days">
            <input {...num("activeWithinDays")} />
          </Field>
          <Field label="Inactive for, days">
            <input {...num("inactiveForDays")} />
          </Field>
        </Group>
      ) : (
        <Group title="Subscribers">
          <Field label="Sources (comma separated, empty = any)" className="sm:col-span-2">
            <ListInput value={filter.subscriberSources} onChange={(v) => set("subscriberSources", v)} placeholder="resume-guide, salary-report" />
          </Field>
          <Field label="Joined within, days">
            <input {...num("signedUpWithinDays")} />
          </Field>
          <Field label="Joined more than, days ago">
            <input {...num("signedUpBeforeDays")} />
          </Field>
        </Group>
      )}

      {users ? (
        <Group title="What they have done">
          <Field label="Has a resume">
            <select
              className={INPUT}
              value={filter.hasResume === undefined ? "" : filter.hasResume ? "yes" : "no"}
              onChange={(e) => set("hasResume", e.target.value === "" ? undefined : e.target.value === "yes")}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Credits at most">
            <input {...num("creditsAtMost")} />
          </Field>
          <Field label="Applications, at least">
            <input {...num("minApplications")} />
          </Field>
          <Field label="Applications, at most">
            <input {...num("maxApplications")} />
          </Field>
        </Group>
      ) : null}

      <Group title="Mail behaviour">
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-semibold text-gray-600">Engagement (none = any)</p>
          <ChipPicker<EngagementLevel> label="Engagement" values={filter.engagement ?? []} options={LEVEL_OPTIONS} onChange={(v) => set("engagement", v)} />
        </div>
        <Field label="Clicked campaign">
          <select className={INPUT} value={filter.clickedCampaignId ?? ""} onChange={(e) => set("clickedCampaignId", e.target.value || undefined)}>
            <option value="">Any</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input type="checkbox" checked={Boolean(filter.neverOpened)} onChange={(e) => set("neverOpened", e.target.checked || undefined)} /> Never opened a mail
        </label>
        {users ? (
          <Field label="Mail tags (comma separated, from playbook tag steps)" className="sm:col-span-2">
            <ListInput value={filter.mailTags} onChange={(v) => set("mailTags", v)} placeholder="unhappy" />
          </Field>
        ) : null}
      </Group>
    </div>
  );
};

const Group: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <fieldset className="rounded-md border border-gray-300 bg-white p-4">
    <legend className="px-1 text-sm font-bold">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </fieldset>
);

export default AudienceFilterEditor;
