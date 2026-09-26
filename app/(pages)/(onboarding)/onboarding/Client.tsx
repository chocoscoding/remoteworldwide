"use client";

// The setup page: an OPTIONAL resume to start from (step 1 — it only
// pre-fills, and "Skip — I'll fill it in" goes straight to the form), the
// profile (step 2), and the server's seven-item checklist beside them, which
// is what the extension reads too. Guidance, not a lock (owner, 2026-09-26):
// nothing anywhere waits on it, and a resume is not an item — one can be
// built from the profile.
//
// Everything counts only once the server says so — `GET /api/settings/me`'s
// `onboarding`, refetched after every save. The page asks it fresh on
// arrival, because a profile saved in another tab moves the checklist without
// touching this cache.
//
// `/onboarding#<itemId>` opens the form at that field, focused (`itemFromHash`)
// — the link the extension's "Finish your profile" callout and chat's "this is
// missing" buttons point at, and the dashboard banner uses too.
//
// Finishing is a navigation on purpose: when the checklist turns complete
// during this visit, the page PUSHES /onboarding/done. That route change is
// what the extension listens for on the site (`rww/visit`) to ask again and
// drop its prompts. Someone who arrives already complete is not bounced — they
// may have come to change something — and gets a "Continue" instead. Unsaved
// edits and a resume still being read both hold the navigation, so finishing
// never throws away something typed.

import { useEffect, useReducer, useState, type FC } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsMutating } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, PartyPopper, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { OnboardingItemId } from "@/app/lib/settings/types";
import { READ_RESUME_KEY, doneHref } from "@/app/lib/onboarding/api";
import {
  EMPTY_FORM_STATE,
  ITEM_FIELD,
  educationProblems,
  formFromProfile,
  formReducer,
  formSatisfies,
  itemFromHash,
  toProfilePatch,
  type ProfileForm,
} from "@/app/lib/onboarding/profile";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";
import { useSaveSettingsSection } from "@/hooks/mutations/useSettingsMutations";
import OnboardingHeader from "@/app/components/onboarding/OnboardingHeader";
import OnboardingChecklist from "@/app/components/onboarding/OnboardingChecklist";
import ResumeStep from "@/app/components/onboarding/ResumeStep";
import ProfileStep from "@/app/components/onboarding/ProfileStep";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, EYEBROW, STEP_CARD } from "@/app/components/onboarding/ui";

/**
 * Scrolls to where an item is fixed and puts the cursor there: its input, the first input of a group
 * (skills, the first school), or — education with no school yet — its "Add a school" button.
 * Smooth for a click on this page; instant for a deep link, as a browser's own #anchor is — and
 * because a tab the extension opened in the background runs no scroll animation until it is shown.
 */
function jumpTo(id: OnboardingItemId, behavior: ScrollBehavior = "smooth") {
  const field = ITEM_FIELD[id];
  const anchor = field ? document.getElementById(`onb-${field}`) : null;
  if (!anchor) return;
  anchor.scrollIntoView({ behavior, block: "start" });
  const target =
    document.getElementById(`onb-input-${field}`) ??
    anchor.querySelector<HTMLElement>("input:not([readonly]), textarea") ??
    anchor.querySelector<HTMLElement>("button");
  target?.focus({ preventScroll: true });
}

const OnboardingClient: FC<{ next: string | null; email: string | null }> = ({ next, email }) => {
  const router = useRouter();
  const settings = useProfileSettings({ fresh: true });
  const save = useSaveSettingsSection("profile");
  const [state, dispatch] = useReducer(formReducer, EMPTY_FORM_STATE);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  // "Skip — I'll fill it in": the resume step folds to one line, so the form is what's left.
  const [skippedResume, setSkippedResume] = useState(false);
  // A profile save on this page — the difference between finishing here (go
  // to /onboarding/done) and arriving finished (don't).
  const [acted, setActed] = useState(false);
  const reading = useIsMutating({ mutationKey: READ_RESUME_KEY }) > 0;

  const data = settings.data;
  const saved: ProfileForm = formFromProfile(data?.profile);
  const form: ProfileForm = { ...saved, ...state.draft };
  const onboarding = data?.onboarding ?? null;
  const dirty = Object.keys(state.draft).length > 0;
  const blocked = educationProblems(form.education).length > 0;
  const ready = onboarding?.ready ?? false;

  // Open on the server, satisfied by an edit not saved yet. An id this build doesn't know (a newer
  // server's) has no field, and so never reads as pending.
  const pending = new Set<OnboardingItemId>(
    (onboarding?.items ?? [])
      .filter((item) => {
        const field = ITEM_FIELD[item.id];
        return !item.done && field !== undefined && field in state.draft && formSatisfies(item.id, form);
      })
      .map((item) => item.id),
  );

  const finished = acted && ready && !dirty && !save.isPending && !reading;
  const target = doneHref(next);
  useEffect(() => {
    if (finished) router.push(target);
  }, [finished, router, target]);

  // The deep link: on arrival once the form is on screen (it isn't while settings load), then on
  // every hash change, so a second link into a tab already here moves it too. A hash that names no
  // item (`#onb-profile`, junk) leaves the page where it is.
  const formShown = data !== undefined;
  useEffect(() => {
    if (!formShown) return;
    const followHash = () => {
      const id = itemFromHash(window.location.hash);
      if (id) jumpTo(id, "instant");
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [formShown]);

  function onContent(content: ResumeContent, from: string) {
    // The reducer reads the edits made while the resume was being read; only blanks are filled.
    dispatch({ type: "prefill", base: saved, content, stamp: String(Date.now()) });
    setPrefilledFrom(from);
    document.getElementById("onb-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function skipResume() {
    // Folded first (flushSync: the DOM is updated when it returns), so the scroll is measured on the
    // shorter page and lands on the first open field, not where that field sat a moment before.
    flushSync(() => setSkippedResume(true));
    const first = onboarding?.missing.find((id) => ITEM_FIELD[id] !== undefined);
    if (first) jumpTo(first);
    else document.getElementById("onb-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSave() {
    const sent = state.draft;
    const patch = toProfilePatch(sent);
    if (Object.keys(patch).length === 0) return;
    setActed(true);
    save.mutate(patch, { onSuccess: () => dispatch({ type: "saved", sent }) });
  }

  const skipHref = next ?? "/dashboard";

  return (
    <>
      <OnboardingHeader
        email={email}
        action={
          <Link href={skipHref} className="flex-none text-sm font-semibold text-primary/70 underline decoration-primary/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
            Skip for now
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 pt-8 md:px-8 md:pt-12">
        <div className="max-w-2xl">
          <p className={EYEBROW}>Set up · about three minutes</p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-primary md:text-[40px] md:leading-[1.1]">Get ready to apply anywhere</h1>
          <p className="mt-3 text-pretty text-base leading-relaxed text-primary/65">
            Your profile is what the extension fills applications from, and what tailored resumes, cover letters and chat answer from. Start from your
            resume if you have one, or just type it in.
          </p>
        </div>

        {ready && !finished && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] border-primary bg-secondary px-4 py-3.5 md:px-5" role="status">
            <PartyPopper className="h-5 w-5 flex-none text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-semibold text-primary">
              {dirty ? "That's everything — save your profile to finish." : "You're all set. The extension has everything it needs."}
            </p>
            {!dirty && (
              <Link href={target} className={cn(BUTTON_PRIMARY, "py-2")}>
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        )}

        {settings.isPending ? (
          <div className={cn(STEP_CARD, "mt-8 flex items-center gap-3 p-6 text-sm text-primary/60")}>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Loading your profile…
          </div>
        ) : !data ? (
          <div className={cn(STEP_CARD, "mt-8 flex flex-wrap items-center gap-3 p-6")} role="alert">
            <p className="min-w-0 flex-1 text-sm text-primary">We couldn&apos;t load your profile: {apiMessage(settings.error)}</p>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => void settings.refetch()}>
              <RotateCw className="h-4 w-4" aria-hidden />
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <ResumeStep used={prefilledFrom !== null} skipped={skippedResume} onSkip={skipResume} onUnskip={() => setSkippedResume(false)} onContent={onContent} />
              <ProfileStep
                form={form}
                saved={saved}
                dirty={dirty}
                done={ready}
                prefilled={state.prefilled}
                prefilledFrom={prefilledFrom}
                blocked={blocked}
                saving={save.isPending}
                edit={(patch) => dispatch({ type: "edit", patch })}
                dismissPrefill={() => dispatch({ type: "dismiss-prefill" })}
                onSave={onSave}
              />
            </div>
            {/* Step 3. First on a phone (what's left, before the work), beside the steps on a wide screen.
                Absent on a backend that doesn't compute it yet — the form still saves; there is just no list. */}
            {onboarding && (
              <aside className="order-first lg:sticky lg:top-6 lg:order-none">
                <OnboardingChecklist items={onboarding.items} pending={pending} onJump={jumpTo} />
              </aside>
            )}
          </div>
        )}
      </main>
    </>
  );
};

export default OnboardingClient;
