"use client";

// The setup page, inside the dashboard: an OPTIONAL resume to start from
// (step 1 — it only pre-fills, and "Skip — I'll fill it in" goes straight to
// the form), the profile (step 2), and the server's seven-item checklist
// beside them, which is what the extension reads too. Guidance, not a lock
// (owner, 2026-09-26): nothing anywhere waits on it, and a resume is not an
// item — one can be built from the profile. Work experience is on the form
// and not on the list (owner, 2026-09-27: "experience not required, can be
// skipped").
//
// The dashboard's sidebar stays; nothing else sits above this — the setup
// banner hides on this route, and there is no header bar (owner, 2026-09-27).
//
// The checklist ticks LIVE: an item is done the moment the form holds a valid
// value for it, saved or not (`liveOnboarding`), and the save bar is what says
// there are unsaved changes. The server's `onboarding` stays the truth for
// every field not being edited, and it is asked fresh on arrival, because a
// profile saved in another tab moves it without touching this cache.
//
// `/dashboard/onboarding#<itemId>` opens the form at that field, focused
// (`itemFromHash`) — the link the extension's "Finish your profile" callout
// and chat's "this is missing" buttons point at, and the dashboard banner uses
// too. `#experience` opens the optional work-experience section.
//
// Finishing is a navigation on purpose: when the server's checklist turns
// complete after a save on this page, it PUSHES /dashboard/onboarding/done.
// That route change is what the extension listens for on the site
// (`rww/visit`) to ask again and drop its prompts. Someone who arrives already
// complete is not bounced — they may have come to change something — and gets
// a "Continue" instead. Unsaved edits and a resume still being read both hold
// the navigation, so finishing never throws away something typed.

import { useEffect, useReducer, useState, type FC } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsMutating } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, PartyPopper, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { READ_RESUME_KEY, doneHref } from "@/app/lib/onboarding/api";
import {
  ANCHOR_FIELD,
  EMPTY_FORM_STATE,
  ITEM_FIELD,
  educationProblems,
  experienceProblems,
  formFromProfile,
  formReducer,
  itemFromHash,
  liveOnboarding,
  toProfilePatch,
  type FormAnchor,
  type ProfileForm,
} from "@/app/lib/onboarding/profile";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";
import { useSaveSettingsSection } from "@/hooks/mutations/useSettingsMutations";
import { useSidebarCollapse } from "@/app/components/dashboard/SidebarCollapseContext";
import OnboardingChecklist from "@/app/components/onboarding/OnboardingChecklist";
import ResumeStep from "@/app/components/onboarding/ResumeStep";
import ProfileStep from "@/app/components/onboarding/ProfileStep";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, EYEBROW, STEP_CARD } from "@/app/components/onboarding/ui";

/**
 * Scrolls to where a field is fixed and puts the cursor there: its input, the first input of a
 * group (skills, the first school, the first role), or — a list with nothing in it yet — its "Add"
 * button. Smooth for a click on this page; instant for a deep link, as a browser's own #anchor is —
 * and because a tab the extension opened in the background runs no scroll animation until shown.
 */
function jumpTo(id: FormAnchor, behavior: ScrollBehavior = "smooth") {
  const field = ANCHOR_FIELD[id];
  const anchor = field ? document.getElementById(`onb-${field}`) : null;
  if (!anchor) return;
  anchor.scrollIntoView({ behavior, block: "start" });
  const target =
    document.getElementById(`onb-input-${field}`) ??
    anchor.querySelector<HTMLElement>("input:not([readonly]), textarea") ??
    anchor.querySelector<HTMLElement>("button");
  target?.focus({ preventScroll: true });
}

const OnboardingClient: FC<{ next: string | null }> = ({ next }) => {
  const router = useRouter();
  const settings = useProfileSettings({ fresh: true });
  const save = useSaveSettingsSection("profile");
  const { setCollapsed } = useSidebarCollapse();
  const [state, dispatch] = useReducer(formReducer, EMPTY_FORM_STATE);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  // "Skip — I'll fill it in": the resume step folds to one line, so the form is what's left.
  const [skippedResume, setSkippedResume] = useState(false);
  // A profile save on this page — the difference between finishing here (go
  // to the done page) and arriving finished (don't).
  const [acted, setActed] = useState(false);
  const reading = useIsMutating({ mutationKey: READ_RESUME_KEY }) > 0;

  // The dashboard has no phone layout of its own: its full sidebar would leave this page a sliver
  // of a phone's width. Folded to its icon rail on arrival here; the rail's own button opens it.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setCollapsed(true);
  }, [setCollapsed]);

  const data = settings.data;
  const saved: ProfileForm = formFromProfile(data?.profile);
  const form: ProfileForm = { ...saved, ...state.draft };
  const dirty = Object.keys(state.draft).length > 0;
  const educationBlocked = educationProblems(form.education).length > 0;
  const experienceBlocked = experienceProblems(form.experience).length > 0;
  const blocked = educationBlocked
    ? "One education entry needs a school name."
    : experienceBlocked
      ? "One role needs a job title or a company."
      : null;

  // The server's checklist, and the same list as the form stands right now. The server's `ready`
  // is what finishing waits for — it is what the extension will read — and the live one is what
  // the page shows.
  const serverOnboarding = data?.onboarding ?? null;
  const onboarding = serverOnboarding ? liveOnboarding(serverOnboarding, form, state.draft) : null;
  const ready = onboarding?.ready ?? false;

  const finished = acted && (serverOnboarding?.ready ?? false) && !dirty && !save.isPending && !reading;
  const target = doneHref(next);
  useEffect(() => {
    if (finished) router.push(target);
  }, [finished, router, target]);

  // The deep link: on arrival once the form is on screen (it isn't while settings load), then on
  // every hash change, so a second link into a tab already here moves it too. A hash that names no
  // field (`#onb-profile`, junk) leaves the page where it is.
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
    // The query container the page's width decisions read — the checklist beside the steps and its
    // columns — rather than the screen's width, since the dashboard's sidebar takes its share.
    <div className="min-h-screen bg-primary2 [container-type:inline-size]">
      <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 pt-6 md:px-8 md:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl">
            <p className={EYEBROW}>Set up · about three minutes</p>
            <h1 className="mt-2 text-balance text-[28px] font-bold leading-tight tracking-tight text-primary [@container(min-width:720px)]:text-4xl">
              Get ready to apply anywhere
            </h1>
            <p className="mt-3 text-pretty text-base leading-relaxed text-primary/65">
              Your profile is what the extension fills applications from, and what tailored resumes, cover letters and chat answer from. Start from your
              resume if you have one, or just type it in.
            </p>
          </div>
          <Link
            href={skipHref}
            className="flex-none pt-0.5 text-sm font-semibold text-primary/70 underline decoration-primary/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
            Skip for now
          </Link>
        </div>

        {ready && !finished && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] border-primary bg-secondary px-4 py-3.5 md:px-5" role="status">
            <PartyPopper className="h-5 w-5 flex-none text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-semibold text-primary">
              {dirty ? "That's everything. Save your profile to finish." : "You're all set. The extension has everything it needs."}
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
          <div className="mt-8 grid grid-cols-1 gap-6 [@container(min-width:960px)]:grid-cols-[minmax(0,1fr)_300px] [@container(min-width:960px)]:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <ResumeStep used={prefilledFrom !== null} skipped={skippedResume} onSkip={skipResume} onUnskip={() => setSkippedResume(false)} onContent={onContent} />
              <ProfileStep
                form={form}
                saved={saved}
                dirty={dirty}
                done={ready}
                prefilled={state.prefilled}
                prefilledFrom={prefilledFrom}
                skillsLeftOut={state.skillsLeftOut}
                blocked={blocked}
                saving={save.isPending}
                edit={(patch) => dispatch({ type: "edit", patch })}
                dismissPrefill={() => dispatch({ type: "dismiss-prefill" })}
                onSave={onSave}
              />
            </div>
            {/* Step 3. First while the page is narrow (what's left, before the work), beside the steps
                once it is wide. Absent on a backend that doesn't compute it yet — the form still
                saves; there is just no list. */}
            {onboarding && (
              <aside className="order-first [@container(min-width:960px)]:sticky [@container(min-width:960px)]:top-6 [@container(min-width:960px)]:order-none">
                <OnboardingChecklist items={onboarding.items} onJump={jumpTo} />
              </aside>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default OnboardingClient;
