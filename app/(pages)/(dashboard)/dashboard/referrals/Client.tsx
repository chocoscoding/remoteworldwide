"use client";

// Referral search — job-first.
//
// The screen answers one question: who can refer me for THIS job, how do I
// reach them, and what do I say? So you pick a job (one of ours, or paste any
// posting), and everything below is about that job: who's inside, their email
// and LinkedIn, and an intro written for that person and that role.
//
// Browsing the whole network is the second tab, not the front door.

import { FC, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, Network, Search, SearchX, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";
import { TIE_META } from "@/app/lib/dashboard/mock-data";
import type { TieKind } from "@/app/lib/dashboard/types";
import ContactRow from "@/app/components/dashboard/referrals/ContactRow";
import DraftPanel from "@/app/components/dashboard/referrals/DraftPanel";
import NetworkSourcesDialog from "@/app/components/dashboard/referrals/NetworkSourcesDialog";

type Tab = "all" | "job";
type TieFilter = "all" | TieKind;

const TIE_FILTERS: { id: TieFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "strong", label: "Strong ties" },
  { id: "second", label: "2nd degree" },
  { id: "alumni", label: "Alumni" },
];

const clampPage = (page: number, total: number) => Math.min(Math.max(page, 1), Math.max(total, 1));

const ReferralsClient: FC = () => {
  const { contacts, askedContactIds, contactsForJob } = useNetwork();
  const params = useSearchParams();

  // Read the deep link once, at mount — ?contact=ref-maria opens her draft and
  // preselects the open job at her company so it lands job-tailored.
  const [deepLinked] = useState(() => {
    const id = params.get("contact");
    return id ? contacts.find((c) => c.id === id) : undefined;
  });

  const [job, setJob] = useState<JobOption | null>(() => {
    if (!deepLinked) return null;
    return PLATFORM_JOBS.find((j) => j.company.toLowerCase() === deepLinked.company.toLowerCase()) ?? null;
  });
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  // Your contacts are the default view; narrowing to a job is the step you
  // take from there (or arrive at via a deep link that already has one).
  const [tab, setTab] = useState<Tab>(() => (deepLinked ? "job" : "all"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinked?.id ?? null);
  const [query, setQuery] = useState("");
  const [tieFilter, setTieFilter] = useState<TieFilter>("all");
  const [openRoleOnly, setOpenRoleOnly] = useState(false);
  const [sameTzOnly, setSameTzOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);

  const draftRef = useRef<HTMLDivElement | null>(null);

  const paths = useMemo(() => (job ? contactsForJob(job.company) : null), [job, contactsForJob]);
  const selected = selectedId ? contacts.find((c) => c.id === selectedId) : undefined;

  // Companies that actually have a live role — what "Open role" filters on.
  const openRoleCompanies = useMemo(() => new Set(jobs.map((j) => j.company.toLowerCase())), [jobs]);
  const myTimezone = "GMT+1";

  const filteredAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => {
        if (tieFilter !== "all" && c.tie !== tieFilter) return false;
        if (openRoleOnly && !openRoleCompanies.has(c.company.toLowerCase())) return false;
        if (sameTzOnly && c.timezone !== myTimezone) return false;
        if (!q) return true;
        return `${c.name} ${c.company} ${c.role} ${c.targetRole}`.toLowerCase().includes(q);
      })
      .sort((a, b) => TIE_META[a.tie].rank - TIE_META[b.tie].rank);
  }, [contacts, query, tieFilter, openRoleOnly, sameTzOnly, openRoleCompanies]);

  const totalPages = Math.max(1, Math.ceil(filteredAll.length / pageSize));
  const currentPage = clampPage(page, totalPages);
  const pagedAll = filteredAll.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const tieCounts: Record<TieFilter, number> = {
    all: contacts.length,
    strong: contacts.filter((c) => c.tie === "strong").length,
    second: contacts.filter((c) => c.tie === "second").length,
    alumni: contacts.filter((c) => c.tie === "alumni").length,
  };

  function openDraft(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function chooseJob(next: JobOption) {
    setJob(next);
    setPickerOpen(false);
    setTab("job");
    setSelectedId(null);
  }

  function resetFilters<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  const selectedInDirect = !!(job && selected && paths?.direct.some((c) => c.id === selected.id));

  // One draft panel, slotted directly under whichever list holds the person
  // you're writing to — never below unrelated sections.
  const draftBlock = selected ? (
    <div ref={draftRef} className="scroll-mt-24">
      <DraftPanel key={`${selected.id}:${job?.id ?? "none"}`} contact={selected} job={job ?? undefined} />
    </div>
  ) : null;

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
          {!job && (
            <StickerButton variant="primary" size="md" onClick={() => setPickerOpen(true)}>
              <Briefcase className="h-4 w-4" />
              Pick a job
            </StickerButton>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {/* Job context — the page's anchor. Ink, because everything below is
            subordinate to this one decision. */}
        {job ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#222325] p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-content-center rounded-lg bg-[#e1f073]">
                <Briefcase className="h-4 w-4 text-[#222325]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-white">{job.role}</p>
                <p className="truncate text-xs text-white/60">
                  {job.company}
                  {job.source === "pasted" && " · pasted in"}
                  {paths && ` · ${paths.direct.length} ${paths.direct.length === 1 ? "person" : "people"} inside`}
                </p>
              </div>
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="h-8 cursor-pointer rounded-lg border-[1.5px] border-white/30 px-3 text-xs font-semibold text-white transition-colors hover:border-white">
                Change job
              </button>
              <button
                type="button"
                aria-label="Clear selected job"
                onClick={() => {
                  setJob(null);
                  setSelectedId(null);
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
            { id: "all", label: "All contacts", count: contacts.length },
            { id: "job", label: "For this job", count: paths?.direct.length },
          ]}
        />

        {tab === "job" ? (
          !job ? (
            <DashEmptyState
              icon={Briefcase}
              title="No job selected yet"
              body="Pick a role and this fills with the people who can get you in front of it."
              ctaLabel="Pick a job"
              onCta={() => setPickerOpen(true)}
            />
          ) : (
            <div className="flex flex-col gap-8">
              <section>
                <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-bold text-primary">
                    {paths!.direct.length > 0
                      ? `${paths!.direct.length} ${paths!.direct.length === 1 ? "person" : "people"} inside ${job.company}`
                      : `Nobody inside ${job.company} yet`}
                  </h2>
                  {paths!.direct.length > 0 && <span className="text-xs text-black/55">Warmest first</span>}
                </div>

                {paths!.direct.length > 0 ? (
                  // The payoff surface — the page's one accent moment.
                  <DashCard className="overflow-hidden border-[1.5px] border-[#222325] p-0 shadow-[4px_4px_0_0_#e1f073]">
                    <div className="flex flex-col divide-y divide-black/8">
                      {paths!.direct.map((c) => (
                        <ContactRow
                          key={c.id}
                          contact={c}
                          jobRole={job.role}
                          asked={askedContactIds.has(c.id)}
                          selected={selectedId === c.id}
                          onDraft={() => openDraft(c.id)}
                        />
                      ))}
                    </div>
                  </DashCard>
                ) : (
                  <DashEmptyState
                    icon={Users}
                    title={`No contacts at ${job.company}`}
                    body="Nobody in your network works there. The people below might still know someone — or connect a real network source to widen the search."
                    ctaLabel="Network sources"
                    onCta={() => setSourcesOpen(true)}
                  />
                )}
              </section>

              {selectedInDirect && draftBlock}

              {paths!.adjacent.length > 0 && (
                <section>
                  <div className="mb-3.5">
                    {/* Deliberately the quiet tier — an aside, not a peer of
                        the direct list. */}
                    <h2 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55">Might know someone</h2>
                    <p className="mt-1 text-xs text-black/55">
                      Recruiters and alumni elsewhere — they can&apos;t refer you to {job.company}, but they can point you at
                      whoever can.
                    </p>
                  </div>
                  <DashCard className="overflow-hidden p-0">
                    <div className="flex flex-col divide-y divide-black/8">
                      {paths!.adjacent.map((c) => (
                        <ContactRow
                          key={c.id}
                          contact={c}
                          quiet
                          asked={askedContactIds.has(c.id)}
                          selected={selectedId === c.id}
                          onDraft={() => openDraft(c.id)}
                        />
                      ))}
                    </div>
                  </DashCard>
                </section>
              )}

              {selected && !selectedInDirect && draftBlock}
            </div>
          )
        ) : (
          <div>
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
              <input
                type="text"
                value={query}
                onChange={(e) => resetFilters(setQuery, e.target.value)}
                placeholder="Search by name, company or role…"
                className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {TIE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={tieFilter === f.id}
                  onClick={() => resetFilters(setTieFilter, f.id)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    tieFilter === f.id ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary"
                  )}>
                  {f.label}
                  <span className={cn("font-normal tabular-nums", tieFilter === f.id ? "text-black/60" : "text-black/55")}>
                    {tieCounts[f.id]}
                  </span>
                </button>
              ))}

              <span aria-hidden className="mx-1 h-4 w-px bg-black/10" />

              {[
                { on: openRoleOnly, toggle: () => resetFilters(setOpenRoleOnly, !openRoleOnly), label: "Open role" },
                { on: sameTzOnly, toggle: () => resetFilters(setSameTzOnly, !sameTzOnly), label: "Same timezone" },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  aria-pressed={t.on}
                  onClick={t.toggle}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    t.on ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary"
                  )}>
                  {t.label}
                </button>
              ))}
            </div>

            {filteredAll.length === 0 ? (
              query.trim() ? (
                <DashEmptyState
                  icon={SearchX}
                  title={`Nobody matches “${query.trim()}”`}
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
                    setTieFilter("all");
                    setOpenRoleOnly(false);
                    setSameTzOnly(false);
                    setPage(1);
                  }}
                />
              )
            ) : (
              <DashCard className="overflow-hidden p-0">
                <div className="flex flex-col divide-y divide-black/8">
                  {pagedAll.map((c) => (
                    <ContactRow
                      key={c.id}
                      contact={c}
                      asked={askedContactIds.has(c.id)}
                      selected={selectedId === c.id}
                      onDraft={() => openDraft(c.id)}
                    />
                  ))}
                </div>
              </DashCard>
            )}

            <DashPagination
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredAll.length}
              itemNoun="contacts"
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                const firstVisible = (currentPage - 1) * pageSize;
                setPageSize(next);
                setPage(Math.floor(firstVisible / next) + 1);
              }}
            />
          </div>
        )}

        {tab === "all" && draftBlock && <div className="mt-8">{draftBlock}</div>}
      </main>

      <JobPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        jobs={jobs}
        onPick={chooseJob}
        onCreate={(input) => {
          const created = createPastedJob(input);
          setJobs((prev) => [created, ...prev]);
          chooseJob(created);
        }}
      />
      <NetworkSourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
};

export default ReferralsClient;
