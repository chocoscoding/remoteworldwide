"use client";

// Referral search — job-first.
//
// The screen answers one question: who can refer me for THIS job, how do I
// reach them, and what do I say? So you pick a job (one of ours, or paste any
// posting), and everything below is about that job: the people you already
// know at its company, a web search for the people there (WebReferrals —
// LinkedIn profiles, likely work emails, open roles near it) and an intro
// written for that person and that role.
//
// Your own network is the other tab: the contacts you brought in — LinkedIn
// connections from a Connections.csv import, people you saved from a search,
// people you added by hand — paged and searched on the server. Filters are only
// what the data can back: where a contact came from, and whether their company
// is hiring on Remote Worldwide right now.

import { FC, Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Loader2, Network, RotateCw, Search, SearchX, Upload, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import JobContextBanner from "@/app/components/dashboard/jobs/JobContextBanner";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { backToJobHref, readJobContext } from "@/app/lib/dashboard/contextParams";
import type { PickedJob } from "@/app/lib/jobs/fields";
import type { ReferralContact } from "@/app/lib/dashboard/types";
import type { ReferralPerson } from "@/app/lib/referrals/types";
import type { ContactCounts, ContactSource } from "@/app/lib/contacts/types";
import { contactToReferral, foundContact } from "@/app/lib/contacts/people";
import { useReferralSearch } from "@/hooks/queries/useReferralSearch";
import { useContact, useContacts } from "@/hooks/queries/useContactsQuery";
import { useDebouncedValue } from "@/hooks/queries/useJobQueries";
import { useDeleteContact } from "@/hooks/mutations/useContactMutations";
import ContactRow from "@/app/components/dashboard/referrals/ContactRow";
import DraftPanel from "@/app/components/dashboard/referrals/DraftPanel";
import NetworkSourcesDialog from "@/app/components/dashboard/referrals/NetworkSourcesDialog";
import WebReferrals from "@/app/components/dashboard/referrals/WebReferrals";

type Tab = "all" | "job";
type SourceFilter = "all" | ContactSource;

/** Where a contact came from — the only tie the data can honestly back. */
const SOURCE_FILTERS: { id: SourceFilter; label: string; count: (c: ContactCounts) => number }[] = [
  { id: "all", label: "All", count: (c) => c.all },
  { id: "linkedin-csv", label: "LinkedIn", count: (c) => c["linkedin-csv"] },
  { id: "web", label: "Found online", count: (c) => c.web },
  { id: "manual", label: "Added by you", count: (c) => c.manual },
];

const SEARCH_DEBOUNCE_MS = 250;
/** How many of your contacts at a job's company the For a job tab lists; the rest are a search away on All contacts. */
const KNOWN_PAGE = 50;
/** Rows shown before "Show all" — as in the search results below it. */
const KNOWN_PREVIEW = 6;

// Who's hiring, and for what: all a referral ask needs. One constant feeds
// both the pick and the type, so they cannot drift.
const REFERRAL_JOB_SPEC = "company, role";

/** A Mongo id — anything else in ?contact= is a stale link from the old sample list. */
const CONTACT_ID = /^[0-9a-f]{24}$/i;

/**
 * The job being referred for: always a saved job, either picked here or handed
 * over by a link from its own screen (?savedJobId=…&company=…&role=…). The id is
 * all the search sends; company and role are for showing.
 */
interface ReferralTarget {
  id: string;
  company: string;
  role: string;
  pasted: boolean;
}

const targetOf = (job: PickedJob<typeof REFERRAL_JOB_SPEC>): ReferralTarget => ({
  id: job.id,
  company: job.company,
  role: job.role,
  pasted: job.source !== "platform",
});

const askJobOf = (job: ReferralTarget | null) => (job ? { company: job.company, role: job.role, savedJobId: job.id } : undefined);

const ReferralsScreen: FC = () => {
  const { isAsked, askedContactIds } = useNetwork();
  const params = useSearchParams();
  const { pickJob } = useJobPicker();
  const context = readJobContext(params, "savedJobId");
  const [contextDismissed, setContextDismissed] = useState(false);

  // Read the deep link once, at mount — ?contact=<id> opens that contact's
  // draft on All contacts, whichever page they are on. A job cannot be picked
  // by a link, so the draft opens untailored; Pick a job tailors it from there.
  const [deepLinkId, setDeepLinkId] = useState<string | null>(() => {
    const id = params.get("contact");
    return id && CONTACT_ID.test(id) ? id : null;
  });
  const deepLinked = useContact(deepLinkId);

  // A link from a job's own screen lands on that job's search; otherwise your
  // contacts are the default view, and narrowing to a job is the step from there.
  const [job, setJob] = useState<ReferralTarget | null>(() =>
    context.savedJobId && context.company ? { id: context.savedJobId, company: context.company, role: context.role ?? "", pasted: false } : null,
  );
  const [tab, setTab] = useState<Tab>(() => (context.savedJobId && context.company ? "job" : "all"));
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // The contact whose intro is open on All contacts. Held whole, not by id, so
  // paging or searching away from them never closes the draft.
  const [picked, setPicked] = useState<ReferralContact | null>(null);
  // Whoever's intro is open on the For a job tab: someone you know there, or someone the search found.
  const [jobDraft, setJobDraft] = useState<ReferralContact | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [hiringOnly, setHiringOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);

  const draftRef = useRef<HTMLDivElement | null>(null);

  const q = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const contacts = useContacts({ q, source: source === "all" ? undefined : source, hiring: hiringOnly || undefined, page, pageSize });
  const counts = contacts.data?.counts;
  const items = contacts.data?.items ?? [];
  const total = contacts.data?.total ?? 0;
  const removeContact = useDeleteContact();

  // Your own contacts at the job's company — the warmest paths there are. People
  // saved from a web search are strangers, not people you know, so they stay in
  // the search results below rather than under this heading. Never the previous
  // job's people under this job's heading while the new list loads.
  const known = useContacts({ company: job ? [job.company] : [], pageSize: KNOWN_PAGE }, { enabled: tab === "job" && !!job?.company });
  const knownPeople = known.isPlaceholderData ? [] : (known.data?.items ?? []).map(contactToReferral).filter((c) => c.tie !== "cold");
  const moreKnown = (known.data?.total ?? 0) > KNOWN_PAGE;
  const [showAllKnown, setShowAllKnown] = useState(false);
  // The person being written to always stays on screen, even past the preview.
  const shownKnown = showAllKnown ? knownPeople : knownPeople.filter((c, i) => i < KNOWN_PREVIEW || c.id === jobDraft?.id);

  // Shares WebReferrals' cache entry, so this is the same free read, not a second one.
  const found = useReferralSearch(job?.id ?? null);
  const foundCount = found.data ? found.data.people.length : undefined;

  const selected = picked ?? (deepLinked.data ? contactToReferral(deepLinked.data) : null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function scrollToDraft() {
    requestAnimationFrame(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openDraft(contact: ReferralContact) {
    setPicked(contact);
    setDeepLinkId(null);
    scrollToDraft();
  }

  function openJobDraft(contact: ReferralContact) {
    setJobDraft(contact);
    scrollToDraft();
  }

  function openFoundDraft(person: ReferralPerson) {
    if (job) openJobDraft(foundContact(person, job));
  }

  function remove(contact: ReferralContact) {
    removeContact.mutate(
      { id: contact.id, name: contact.name },
      {
        onSuccess: () => {
          if (selected?.id === contact.id) {
            setPicked(null);
            setDeepLinkId(null);
          }
          // The last person on a later page: step back rather than show an empty page.
          if (items.length === 1 && page > 1) setPage(page - 1);
        },
      },
    );
  }

  async function chooseJob() {
    const result = await pickJob(REFERRAL_JOB_SPEC);
    if (result.status !== "picked") return;
    setJob(targetOf(result.job));
    setTab("job");
    setPicked(null);
    setDeepLinkId(null);
    setJobDraft(null);
  }

  function resetFilters<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  // One draft panel, slotted directly under whichever list holds the person
  // you're writing to — never below unrelated sections.
  const draftBlock = selected ? (
    <div ref={draftRef} className="scroll-mt-24">
      <DraftPanel key={`${selected.id}:${job?.id ?? "none"}`} contact={selected} job={askJobOf(job)} />
    </div>
  ) : null;

  const jobDraftBlock =
    jobDraft && job ? (
      <div ref={draftRef} className="scroll-mt-24">
        <DraftPanel key={`${jobDraft.id}:${job.id}`} contact={jobDraft} job={askJobOf(job)} />
      </div>
    ) : null;
  // Someone you know is drafted under your list; someone found, under their search group.
  const knownDrafting = !!jobDraft?.contactId;

  const noContactsYet = counts !== undefined && counts.all === 0;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Referral search</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Find the person inside, and what to say to them</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <StickerButton variant="outline" size="md" onClick={() => setSourcesOpen(true)}>
            <Network className="h-4 w-4" />
            Network sources
          </StickerButton>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {!contextDismissed && (
          <JobContextBanner
            className="mb-5"
            action="Finding a referral"
            role={context.role}
            company={context.company}
            backHref={backToJobHref(context)}
            onDismiss={() => setContextDismissed(true)}
          />
        )}

        {/* Job context — the page's anchor. Ink, because everything below is
            subordinate to this one decision. */}
        {job ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#222325] p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-content-center rounded-lg bg-[#e1f073]">
                <Briefcase className="h-4 w-4 text-[#222325]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-white">{job.role || "Role not named"}</p>
                <p className="truncate text-xs text-white/60">
                  {job.company}
                  {job.pasted && " · pasted in"}
                  {foundCount !== undefined && foundCount > 0 && ` · ${foundCount} ${foundCount === 1 ? "person" : "people"} found`}
                </p>
              </div>
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <button
                type="button"
                onClick={chooseJob}
                className="h-8 cursor-pointer rounded-lg border-[1.5px] border-white/30 px-3 text-xs font-semibold text-white transition-colors hover:border-white">
                Change job
              </button>
              <button
                type="button"
                aria-label="Clear selected job"
                onClick={() => {
                  setJob(null);
                  setJobDraft(null);
                }}
                className="grid h-8 w-8 flex-none cursor-pointer place-content-center rounded-lg border-[1.5px] border-white/30 text-white/70 transition-colors hover:border-white hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        <SlidingTabs
          className="mb-5"
          value={tab}
          onChange={(next: Tab) => {
            setTab(next);
            setPage(1);
          }}
          options={[
            { id: "all", label: "All contacts", count: counts?.all },
            { id: "job", label: "For a job", count: foundCount },
          ]}
        />

        {tab === "job" ? (
          !job ? (
            <DashEmptyState
              icon={Briefcase}
              title="No job selected yet"
              body="Pick a role and we'll show who you already know there, and search the web for the people who can get you in front of it."
              ctaLabel="Pick a job"
              onCta={chooseJob}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {knownPeople.length > 0 && (
                <section>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold text-primary">
                      People you know at {job.company}{" "}
                      <span className="font-normal text-black/45 tabular-nums">
                        {knownPeople.length}
                        {moreKnown && "+"}
                      </span>
                    </h3>
                    <span className="text-xs text-black/55">From your contacts — the warmest way in</span>
                  </div>
                  <DashCard className="overflow-hidden border-[1.5px] border-[#222325] p-0 shadow-[4px_4px_0_0_#e1f073]">
                    <div className="flex flex-col divide-y divide-black/8">
                      {shownKnown.map((c) => (
                        <ContactRow
                          key={c.id}
                          contact={c}
                          jobRole={job.role || undefined}
                          asked={isAsked(c)}
                          selected={jobDraft?.id === c.id}
                          onDraft={() => openJobDraft(c)}
                        />
                      ))}
                    </div>
                    {knownPeople.length > KNOWN_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowAllKnown((v) => !v)}
                        className="w-full cursor-pointer border-t border-black/8 px-5 py-2.5 text-left text-xs font-semibold text-black/55 transition-colors hover:bg-[#fbfbf7] hover:text-primary">
                        {showAllKnown ? "Show fewer" : `Show all ${knownPeople.length}`}
                      </button>
                    )}
                  </DashCard>
                  {knownDrafting && <div className="mt-6">{jobDraftBlock}</div>}
                </section>
              )}
              <WebReferrals
                key={job.id}
                savedJobId={job.id}
                company={job.company}
                role={job.role}
                askedIds={askedContactIds}
                draftingId={jobDraft && !knownDrafting ? jobDraft.id : null}
                onDraft={openFoundDraft}
                draft={knownDrafting ? null : jobDraftBlock}
              />
            </div>
          )
        ) : contacts.isPending ? (
          <p className="inline-flex items-center gap-2 text-sm text-black/50" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your contacts…
          </p>
        ) : contacts.isError && !contacts.data ? (
          <DashEmptyState
            icon={RotateCw}
            title="Your contacts didn't load"
            body="Something went wrong reaching the server. Try again in a moment."
            ctaLabel="Try again"
            onCta={() => void contacts.refetch()}
          />
        ) : noContactsYet ? (
          <DashEmptyState
            icon={Users}
            title="Bring in your network"
            body={
              <>
                Import your LinkedIn connections: on LinkedIn, go to Settings → Data privacy → Get a copy of your data, tick Connections,
                and upload the Connections.csv it sends you. You can also save people a job search finds, or add someone by hand.
              </>
            }
            ctaLabel="Import from LinkedIn"
            onCta={() => setSourcesOpen(true)}
          />
        ) : (
          <div>
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
              <input
                type="text"
                value={query}
                onChange={(e) => resetFilters(setQuery, e.target.value)}
                placeholder="Search by name, company or title…"
                aria-label="Search your contacts"
                className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {SOURCE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={source === f.id}
                  onClick={() => resetFilters(setSource, f.id)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    source === f.id ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary",
                  )}>
                  {f.label}
                  <span className={cn("font-normal tabular-nums", source === f.id ? "text-black/60" : "text-black/55")}>
                    {counts ? f.count(counts).toLocaleString() : ""}
                  </span>
                </button>
              ))}

              {/* Only offered when it can match someone: their company has a live job on Remote Worldwide. */}
              {counts && (counts.hiring > 0 || hiringOnly) && (
                <>
                  <span aria-hidden className="mx-1 h-4 w-px bg-black/10" />
                  <button
                    type="button"
                    aria-pressed={hiringOnly}
                    onClick={() => resetFilters(setHiringOnly, !hiringOnly)}
                    title="Their company has a live job on Remote Worldwide"
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      hiringOnly ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary",
                    )}>
                    Hiring now
                    <span className="font-normal tabular-nums text-black/55">{counts.hiring.toLocaleString()}</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setSourcesOpen(true)}
                className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary">
                <Upload className="h-3.5 w-3.5" />
                Import or add
              </button>
            </div>

            {items.length === 0 ? (
              q ? (
                <DashEmptyState
                  icon={SearchX}
                  title={`Nobody matches “${q}”`}
                  body="Try a shorter search, or clear it to see your whole network."
                  ctaLabel="Clear search"
                  onCta={() => resetFilters(setQuery, "")}
                />
              ) : (
                <DashEmptyState
                  icon={SearchX}
                  title="No contacts in this filter"
                  body="Nobody in your network matches all of those at once."
                  ctaLabel="Show everyone"
                  onCta={() => {
                    setSource("all");
                    setHiringOnly(false);
                    setPage(1);
                  }}
                />
              )
            ) : (
              <DashCard className={cn("overflow-hidden p-0 transition-opacity", contacts.isPlaceholderData && "opacity-60")}>
                <div className="flex flex-col divide-y divide-black/8">
                  {items.map((item) => {
                    const c = contactToReferral(item);
                    return (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        asked={isAsked(c)}
                        selected={selected?.id === c.id}
                        onDraft={() => openDraft(c)}
                        onRemove={() => remove(c)}
                        removing={removeContact.isPending && removeContact.variables?.id === c.id}
                      />
                    );
                  })}
                </div>
              </DashCard>
            )}

            <DashPagination
              page={Math.min(page, totalPages)}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              itemNoun="contacts"
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                const firstVisible = (page - 1) * pageSize;
                setPageSize(next);
                setPage(Math.floor(firstVisible / next) + 1);
              }}
            />
          </div>
        )}

        {tab === "all" && draftBlock && <div className="mt-8">{draftBlock}</div>}
      </main>

      <NetworkSourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} counts={counts} />
    </div>
  );
};

const ReferralsFallback: FC = () => (
  <div className="min-h-screen bg-[#f6f6f6]">
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
      <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Referral search</h1>
      <NotificationBell />
    </header>
  </div>
);

const ReferralsClient: FC = () => (
  <Suspense fallback={<ReferralsFallback />}>
    <ReferralsScreen />
  </Suspense>
);

export default ReferralsClient;
