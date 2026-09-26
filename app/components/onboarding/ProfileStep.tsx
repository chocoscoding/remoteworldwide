"use client";

// Step 2: the profile the extension fills forms from — name, email, headline,
// location, About, skills, education (the checklist's seven), phone and links
// (optional). Each item's wrapper is `#onb-<id>`: where the checklist and the
// `/onboarding#<id>` deep link land.
//
// Presentational: the page owns the form's state (saved profile + unsaved
// edits, `app/lib/onboarding/profile.ts`) and the save. The controls are the
// resume editor's own — its field tone, `SkillsEditor`, the Education card
// list — so the two places a person types their history look like one tool.
//
// Email is the account's, shown here and changed on the Account page as
// before; it is only typed here when there is none at all (the prefill may
// then have brought one in from the resume).

import type { FC, ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import SkillsEditor from "@/app/components/dashboard/resume/content/SkillsEditor";
import { FIELD_CLASS, FIELD_TONE } from "@/app/components/dashboard/resume/content/FormField";
import { FIELD_LABELS, MIN_SKILLS, PROFILE_LIMITS, cleanSkills, schoolCount, type ProfileField, type ProfileForm } from "@/app/lib/onboarding/profile";
import EducationEditor from "./EducationEditor";
import StepHeading from "./StepHeading";
import { BUTTON_PRIMARY, EYEBROW, HINT, STEP_CARD } from "./ui";

const INPUT = cn(FIELD_CLASS, "w-full rounded-sm focus:shadow-[2px_2px_0_0_#e1f073]", FIELD_TONE.idle);

/**
 * A labelled field with the anchor the checklist scrolls to (`#onb-<id>`). `group` for the two that
 * are several controls (skills, education): a heading then, since there is no one input to label.
 */
const Field: FC<{ id: string; label: string; optional?: boolean; group?: boolean; aside?: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }> = ({
  id,
  label,
  optional,
  group,
  aside,
  hint,
  className,
  children,
}) => {
  const text = (
    <>
      {label}
      {optional && <span className="font-normal text-primary/45"> · optional</span>}
    </>
  );
  return (
    <div id={`onb-${id}`} className={cn("scroll-mt-24", className)} role={group ? "group" : undefined} aria-labelledby={group ? `onb-label-${id}` : undefined}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        {group ? (
          <p id={`onb-label-${id}`} className="text-sm font-semibold text-primary">
            {text}
          </p>
        ) : (
          <label htmlFor={`onb-input-${id}`} className="text-sm font-semibold text-primary">
            {text}
          </label>
        )}
        {aside}
      </div>
      {children}
      {hint && <div className={cn(HINT, "mt-1.5")}>{hint}</div>}
    </div>
  );
};

export interface ProfileStepProps {
  form: ProfileForm;
  /** The saved profile, for what is the account's (email) and what is new. */
  saved: ProfileForm;
  dirty: boolean;
  /** The server counts every profile item as done. */
  done: boolean;
  prefilled: ProfileField[] | null;
  prefilledFrom: string | null;
  /** Rows the backend would refuse (a degree with no school); Save waits for them. */
  blocked: boolean;
  saving: boolean;
  edit: (patch: Partial<ProfileForm>) => void;
  dismissPrefill: () => void;
  onSave: () => void;
}

const ProfileStep: FC<ProfileStepProps> = ({ form, saved, dirty, done, prefilled, prefilledFrom, blocked, saving, edit, dismissPrefill, onSave }) => {
  const skills = cleanSkills(form.skills).length;
  const emailIsAccounts = saved.email.trim().length > 0;

  return (
    <section id="onb-profile" aria-labelledby="onb-profile-title" className={cn(STEP_CARD, "scroll-mt-6 p-5 md:p-7")}>
      <StepHeading
        n={2}
        id="onb-profile-title"
        title="Your profile"
        done={done}
        doneLabel="Complete"
        blurb="What the extension types into application forms. Check it reads like you — it's saved to your profile, and you can change it any time in Settings."
      />

      {prefilled && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-secondary/35 px-3.5 py-3" role="status">
          <Sparkles className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-primary">
            {prefilled.length > 0 ? (
              <>
                Filled from <span className="font-semibold">{prefilledFrom ?? "your resume"}</span>: {prefilled.map((field) => FIELD_LABELS[field]).join(", ")}. Check them, then
                save.
              </>
            ) : (
              <>
                Read <span className="font-semibold">{prefilledFrom ?? "your resume"}</span> — everything it had was already filled in, so nothing changed.
              </>
            )}
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissPrefill}
            className="grid h-6 w-6 flex-none place-content-center rounded-md text-primary/50 transition-colors hover:bg-black/10 hover:text-primary cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field id="fullName" label="Name">
          <input id="onb-input-fullName" className={INPUT} autoComplete="name" maxLength={PROFILE_LIMITS.fullName} value={form.fullName} onChange={(e) => edit({ fullName: e.target.value })} />
        </Field>

        <Field id="headline" label="Headline" hint="One line. It sits under your name everywhere.">
          <input
            id="onb-input-headline"
            className={INPUT}
            maxLength={PROFILE_LIMITS.headline}
            placeholder="Senior Product Designer · Fintech"
            value={form.headline}
            onChange={(e) => edit({ headline: e.target.value })}
          />
        </Field>

        <Field id="location" label="Location">
          <input
            id="onb-input-location"
            className={INPUT}
            autoComplete="address-level2"
            maxLength={PROFILE_LIMITS.location}
            placeholder="Lagos, Nigeria"
            value={form.location}
            onChange={(e) => edit({ location: e.target.value })}
          />
        </Field>

        <Field
          id="email"
          label="Email"
          hint={
            emailIsAccounts ? (
              <>
                From your account.{" "}
                <Link href="/dashboard/settings/account" className="inline-flex items-center gap-0.5 font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
                  Change it on the Account page
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </>
            ) : null
          }>
          {emailIsAccounts ? (
            <input id="onb-input-email" type="email" readOnly value={saved.email} className={cn(INPUT, "border-primary/15 bg-primary2 focus:shadow-none")} />
          ) : (
            <input
              id="onb-input-email"
              type="email"
              className={INPUT}
              autoComplete="email"
              maxLength={PROFILE_LIMITS.email}
              value={form.email}
              onChange={(e) => edit({ email: e.target.value })}
            />
          )}
        </Field>

        <Field id="phone" label="Phone" optional hint="Only used to fill the phone field on applications, and for interview reminders.">
          <input
            id="onb-input-phone"
            type="tel"
            className={INPUT}
            autoComplete="tel"
            maxLength={PROFILE_LIMITS.phone}
            value={form.phone}
            onChange={(e) => edit({ phone: e.target.value })}
          />
        </Field>

        <Field
          id="summary"
          label="About"
          className="md:col-span-2"
          aside={
            <span className="text-[11px] text-primary/45 tabular-nums">
              {form.summary.length}/{PROFILE_LIMITS.summary}
            </span>
          }
          hint="Two or three sentences on what you do and what you're after. Cover letters and answers start from this.">
          <textarea
            id="onb-input-summary"
            rows={4}
            maxLength={PROFILE_LIMITS.summary}
            className={cn(INPUT, "min-h-24 resize-y leading-relaxed")}
            value={form.summary}
            onChange={(e) => edit({ summary: e.target.value })}
          />
        </Field>

        <Field
          id="skills"
          label="Skills"
          group
          className="md:col-span-2"
          aside={
            <span className={cn("text-[11px] font-semibold tabular-nums", skills >= MIN_SKILLS ? "text-[#5c7a14]" : "text-primary/45")}>
              {skills >= MIN_SKILLS ? `${skills} added` : `${skills} of ${MIN_SKILLS} minimum`}
            </span>
          }
          hint="Enter or a comma adds one; paste a list and it splits.">
          <SkillsEditor skills={form.skills} onChange={(next) => edit({ skills: next })} />
        </Field>

        <Field
          id="education"
          label="Education"
          group
          className="md:col-span-2"
          aside={<span className="text-[11px] text-primary/45 tabular-nums">{schoolCount(form.education) > 0 ? `${schoolCount(form.education)} added` : "At least one"}</span>}>
          <EducationEditor rows={form.education} onChange={(rows) => edit({ education: rows })} />
        </Field>

        <div className="md:col-span-2">
          <p className={EYEBROW}>Links · optional</p>
          <div className="mt-2.5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["linkedin", "github", "portfolio"] as const).map((key) => (
              <Field key={key} id={key} label={FIELD_LABELS[key]}>
                <input
                  id={`onb-input-${key}`}
                  className={INPUT}
                  inputMode="url"
                  maxLength={PROFILE_LIMITS.link}
                  placeholder={key === "linkedin" ? "linkedin.com/in/…" : key === "github" ? "github.com/…" : "yoursite.com"}
                  value={form[key]}
                  onChange={(e) => edit({ [key]: e.target.value } as Partial<ProfileForm>)}
                />
              </Field>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky so Save is in reach on a phone without scrolling back past the list. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-b-[18px] border-t border-primary/15 bg-white/95 px-5 py-3.5 backdrop-blur-sm md:-mx-7 md:-mb-7 md:px-7">
        <p className={cn("text-xs", blocked ? "font-semibold text-[#b23c26]" : "text-primary/55")} aria-live="polite">
          {blocked ? "One education entry needs a school name." : dirty ? "Unsaved changes." : "Everything here is saved."}
        </p>
        <button type="button" className={BUTTON_PRIMARY} disabled={!dirty || saving || blocked} onClick={onSave}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </section>
  );
};

export default ProfileStep;
