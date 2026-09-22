"use client";

// Referral search results for one saved job: the people at its company that a
// web search found, the open roles near it, and how to reach the company.
//
// Nothing searches on its own. A search costs a credit, so it runs from a click
// and is stored; opening the screen again shows the stored one for free, and
// "Search again" is the only thing that spends another credit.
//
// Every row links to the page it came from. A person's profile is the proof
// they are there; an email is either "found" on a public page or "likely" —
// built from the company's published email format — and says which.
//
// "Save to contacts" keeps a person in the user's own network (the All contacts
// tab) with the same labels: the profile, the title, and the email marked found
// or likely. Saving is idempotent, and whether each person is already kept is
// asked of the backend with the same identity a save would use.

import { FC, Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BookmarkCheck, BookmarkPlus, Briefcase, Copy, Globe, Linkedin, Loader2, Mail, PenLine, Phone, RotateCw, Search, SearchX } from "lucide-react";
import TimeAgo from "timeago-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { BILLING_HREF } from "@/app/lib/jobs/ask";
import { EMAIL_PATTERN_LABELS, describeReferralFailure, type ReferralFailure } from "@/app/lib/referrals/api";
import type { ReferralGroup, ReferralPerson, ReferralSearchItem } from "@/app/lib/referrals/types";
import { useRunReferralSearch } from "@/hooks/mutations/useRunReferralSearch";
import { useReferralSearch } from "@/hooks/queries/useReferralSearch";
import { useSaveContact } from "@/hooks/mutations/useContactMutations";
import { useContactLookup } from "@/hooks/queries/useContactsQuery";
import { foundPersonContact, hasAsked, linkedinSlug } from "@/app/lib/contacts/people";

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

const GROUPS: { id: ReferralGroup; title: string; hint: string }[] = [
  { id: "hiring", title: "Hiring managers & leads", hint: "Most likely to own this hire" },
  { id: "recruiting", title: "Recruiters & people team", hint: "They run the process and know who's hiring" },
  { id: "team", title: "On the team", hint: "They do this work today, and can refer you" },
];

/** Rows shown per list before "Show all" — long lists are scanned, not read. */
const PREVIEW = 6;

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export interface WebReferralsProps {
  savedJobId: string;
  company: string;
  role: string;
  /** Every key a referral ask is known by (NetworkProvider's askedContactIds). */
  askedIds: ReadonlySet<string>;
  /** The found person whose intro is open, if any. */
  draftingId: string | null;
  onDraft: (person: ReferralPerson) => void;
  /** The intro panel, placed directly under the list holding `draftingId`. */
  draft: ReactNode;
}

/** Keyed by saved job at the call site, so a failed search never follows you to the next job. */
const WebReferrals: FC<WebReferralsProps> = ({ savedJobId, company, role, askedIds, draftingId, onDraft, draft }) => {
  const stored = useReferralSearch(savedJobId);
  const run = useRunReferralSearch();
  const search = stored.data ?? null;

  const start = (refresh: boolean) => run.mutate({ savedJobId, refresh });

  if (run.isPending) {
    return (
      <DashCard className="flex items-center gap-3.5 p-6" role="status">
        <Loader2 className="h-5 w-5 flex-none animate-spin text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">Searching LinkedIn and the web for people at {company}…</p>
          <p className="mt-0.5 text-xs text-black/55">Hiring managers, recruiters and the team. This takes a few seconds.</p>
        </div>
      </DashCard>
    );
  }

  if (stored.isPending) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-black/50" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Checking for an earlier search…
      </p>
    );
  }

  const failure = run.isError ? describeReferralFailure(run.error) : null;

  return (
    <div className="flex flex-col gap-6">
      {failure && <FailureCard failure={failure} onRetry={() => start(search !== null)} />}
      {stored.isError && !search ? (
        <FailureCard failure={describeReferralFailure(stored.error)} onRetry={() => void stored.refetch()} />
      ) : search ? (
        <Results
          search={search}
          company={company}
          askedIds={askedIds}
          draftingId={draftingId}
          onDraft={onDraft}
          draft={draft}
          onSearchAgain={() => start(true)}
        />
      ) : (
        !failure && <StartCard company={company} role={role} onStart={() => start(false)} />
      )}
    </div>
  );
};

const StartCard: FC<{ company: string; role: string; onStart: () => void }> = ({ company, role, onStart }) => (
  // The payoff surface: the page's one accent moment until results replace it.
  <DashCard className="border-[1.5px] border-[#222325] p-6 shadow-[4px_4px_0_0_#e1f073]">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="min-w-0 flex-1 basis-[320px]">
        <p className="text-[15px] font-bold text-primary">Find the people who can get you into {company}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-black/60">
          We search LinkedIn and the web for whoever is likely hiring for {role || "this role"}, the recruiters, and the team doing the
          work, with profile links, likely work emails and open roles near this one.
        </p>
        <p className="mt-2 text-xs text-black/50">1 credit per search, and only when it finds someone. Coming back to it later is free.</p>
      </div>
      <StickerButton variant="primary" size="md" onClick={onStart}>
        <Search className="h-4 w-4" />
        Search the web
      </StickerButton>
    </div>
  </DashCard>
);

const FailureCard: FC<{ failure: ReferralFailure; onRetry: () => void }> = ({ failure, onRetry }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#b23c26]/20 bg-[#fdf4f2] px-4 py-3.5" role="alert">
    <div className="min-w-0 flex-1 basis-[260px]">
      {failure.kind === "credits" && <p className="text-sm font-bold text-[#b23c26]">You&apos;re out of credits</p>}
      <p className="text-sm leading-relaxed text-[#b23c26]">{failure.message}</p>
    </div>
    <div className="flex flex-none items-center gap-2">
      {failure.kind === "credits" && (
        <Link href={BILLING_HREF} target="_blank" className={cn(stickerButtonVariants({ variant: "primary", size: "sm" }), "hover:shadow-[3px_3px_0_0_#e1f073]")}>
          Get credits
        </Link>
      )}
      <StickerButton variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="h-3.5 w-3.5" />
        Try again
      </StickerButton>
    </div>
  </div>
);

interface ResultsProps {
  search: ReferralSearchItem;
  company: string;
  askedIds: ReadonlySet<string>;
  draftingId: string | null;
  onDraft: (person: ReferralPerson) => void;
  draft: ReactNode;
  onSearchAgain: () => void;
}

const Results: FC<ResultsProps> = ({ search, company, askedIds, draftingId, onDraft, draft, onSearchAgain }) => {
  const total = search.people.length;
  const kept = useKeptPeople(search.people, company);
  const groups = GROUPS.map((g) => ({ ...g, people: search.people.filter((p) => p.group === g.id) })).filter((g) => g.people.length > 0);
  const nothing = total === 0 && search.openRoles.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-primary">
            {total > 0 ? `${total} ${total === 1 ? "person" : "people"} at ${company}` : `Nobody found at ${company} yet`}
          </h2>
          <p className="mt-0.5 text-xs text-black/55">
            From LinkedIn and the web · searched <TimeAgo datetime={search.searchedAt} />
          </p>
        </div>
        <StickerButton variant="outline" size="sm" onClick={onSearchAgain}>
          <RotateCw className="h-3.5 w-3.5" />
          Search again · 1 credit
        </StickerButton>
      </div>

      {nothing && (
        <DashEmptyState
          icon={SearchX}
          title={`Nothing public turned up for ${company}`}
          body="Small or very new companies often have few public profiles. This search cost nothing — try again later, or check the company's own site."
        />
      )}

      {groups.map((group, index) => (
        <Fragment key={group.id}>
          <PeopleSection
            title={group.title}
            hint={group.hint}
            people={group.people}
            accent={index === 0}
            askedIds={askedIds}
            draftingId={draftingId}
            onDraft={onDraft}
            kept={kept}
          />
          {draftingId && group.people.some((p) => p.id === draftingId) && draft}
        </Fragment>
      ))}

      {search.openRoles.length > 0 && <OpenRoles search={search} company={company} />}
      <ReachingCompany search={search} company={company} />
    </>
  );
};

/**
 * Which found people are already in the user's contacts, and a way to save the
 * rest. The lookup keys each person exactly as saving them would, so "Saved"
 * means a save would change nothing; a save just made shows at once, before
 * the lookup refetches.
 */
function useKeptPeople(people: ReferralPerson[], company: string) {
  const lookup = useContactLookup(
    people.map((p) => ({
      name: p.name,
      company,
      linkedinUrl: linkedinSlug(p.profileUrl) ? p.profileUrl : null,
      email: p.email?.address ?? null,
    })),
  );
  const save = useSaveContact();
  const [justSaved, setJustSaved] = useState<ReadonlySet<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const isSaved = (person: ReferralPerson): boolean => {
    if (justSaved.has(person.id)) return true;
    const index = people.findIndex((p) => p.id === person.id);
    return index >= 0 && !!lookup.data?.[index];
  };
  function saveOne(person: ReferralPerson) {
    setSavingId(person.id);
    save.mutate(foundPersonContact(person, company), {
      onSuccess: () => setJustSaved((prev) => new Set(prev).add(person.id)),
      onSettled: () => setSavingId(null),
    });
  }

  return { isSaved, isSaving: (person: ReferralPerson) => savingId === person.id, save: saveOne };
}

type KeptPeople = ReturnType<typeof useKeptPeople>;

interface PeopleSectionProps {
  title: string;
  hint: string;
  people: ReferralPerson[];
  accent: boolean;
  askedIds: ReadonlySet<string>;
  draftingId: string | null;
  onDraft: (person: ReferralPerson) => void;
  kept: KeptPeople;
}

const PeopleSection: FC<PeopleSectionProps> = ({ title, hint, people, accent, askedIds, draftingId, onDraft, kept }) => {
  const [showAll, setShowAll] = useState(false);
  // The person being written to always stays on screen, even past the preview.
  const shown = showAll ? people : people.filter((p, i) => i < PREVIEW || p.id === draftingId);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-primary">
          {title} <span className="font-normal text-black/45 tabular-nums">{people.length}</span>
        </h3>
        <span className="text-xs text-black/55">{hint}</span>
      </div>
      <DashCard className={cn("overflow-hidden p-0", accent && "border-[1.5px] border-[#222325] shadow-[4px_4px_0_0_#e1f073]")}>
        <div className="flex flex-col divide-y divide-black/8">
          {shown.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              asked={hasAsked(askedIds, { id: person.id, profileUrl: person.profileUrl })}
              selected={draftingId === person.id}
              onDraft={() => onDraft(person)}
              saved={kept.isSaved(person)}
              saving={kept.isSaving(person)}
              onSave={() => kept.save(person)}
            />
          ))}
        </div>
        {people.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full cursor-pointer border-t border-black/8 px-5 py-2.5 text-left text-xs font-semibold text-black/55 transition-colors hover:bg-[#fbfbf7] hover:text-primary">
            {showAll ? "Show fewer" : `Show all ${people.length}`}
          </button>
        )}
      </DashCard>
    </section>
  );
};

interface PersonRowProps {
  person: ReferralPerson;
  asked: boolean;
  selected: boolean;
  onDraft: () => void;
  /** Already in the user's contacts. */
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}

const PersonRow: FC<PersonRowProps> = ({ person, asked, selected, onDraft, saved, saving, onSave }) => {
  const email = person.email;

  async function copyEmail() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email.address);
      toast.success("Email address copied", { description: email.status === "likely" ? `${email.address} (likely, unverified)` : email.address });
    } catch {
      toast.error("Couldn't reach the clipboard");
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors", selected && "bg-[#fbfbf7] shadow-[inset_3px_0_0_0_#e1f073]")}>
      <Avatar name={person.name} />

      <div className="min-w-0 flex-1 basis-[260px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-bold text-primary">{person.name}</p>
          {person.matchesRole && <Pill variant="positive">Matches the role</Pill>}
          {asked && <Pill variant="neutral">Asked</Pill>}
        </div>
        <p className="mt-0.5 truncate text-xs text-black/55">
          {person.title}
          {person.location && ` · ${person.location}`}
        </p>
        {email && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5 flex-none text-black/40" aria-hidden />
            <span className="truncate font-medium text-primary">{email.address}</span>
            <a
              href={email.source}
              target="_blank"
              rel="noreferrer noopener"
              title={email.status === "found" ? `Published on ${hostOf(email.source)}` : `Built from the company's email format (${hostOf(email.source)}), not verified`}
              className={cn(
                "flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold underline-offset-2 hover:underline",
                email.status === "found" ? "bg-[#e1f073] text-primary" : "bg-[#f0f0ea] text-black/60",
              )}>
              {email.status === "found" ? "Found online" : "Likely · unverified"}
            </a>
          </p>
        )}
      </div>

      {/* LinkedIn first: it's the channel people actually answer strangers on. */}
      <div className="flex flex-none items-center gap-0.5">
        <a href={person.profileUrl} target="_blank" rel="noreferrer noopener" className={GHOST_BTN}>
          {person.linkedin ? <Linkedin className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
          {person.linkedin ? "LinkedIn" : "Profile"}
        </a>
        {email && (
          <>
            <a href={`mailto:${email.address}`} className={GHOST_BTN}>
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
            <button type="button" onClick={copyEmail} className={GHOST_BTN} aria-label={`Copy ${person.name}'s email address`}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </>
        )}
        {saved ? (
          <span className={cn(GHOST_BTN, "cursor-default text-[#6c7a1e] hover:bg-transparent hover:text-[#6c7a1e]")} title="In your contacts (All contacts tab)">
            <BookmarkCheck className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={cn(GHOST_BTN, "disabled:cursor-default disabled:opacity-60")}
            aria-label={`Save ${person.name} to your contacts`}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            Save
          </button>
        )}
      </div>

      {selected ? (
        <StickerButton variant="secondary" size="sm" className="flex-none" onClick={onDraft}>
          <PenLine className="h-3.5 w-3.5" />
          Editing
        </StickerButton>
      ) : (
        <StickerButton variant="outline" size="sm" className="flex-none" onClick={onDraft}>
          <PenLine className="h-3.5 w-3.5" />
          Write the intro
        </StickerButton>
      )}
    </div>
  );
};

const OpenRoles: FC<{ search: ReferralSearchItem; company: string }> = ({ search, company }) => {
  const [showAll, setShowAll] = useState(false);
  const roles = showAll ? search.openRoles : search.openRoles.slice(0, PREVIEW);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-primary">
          Open roles near this one <span className="font-normal text-black/45 tabular-nums">{search.openRoles.length}</span>
        </h3>
        <span className="text-xs text-black/55">From {company}&apos;s job board and around the web</span>
      </div>
      <DashCard className="overflow-hidden p-0">
        <ul className="flex flex-col divide-y divide-black/8">
          {roles.map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#fbfbf7]">
                <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                  <Briefcase className="h-4 w-4 text-[#222325]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-primary">{r.title}</span>
                  <span className="block truncate text-[11px] text-black/50">
                    {hostOf(r.url)}
                    {r.publishedDate && ` · posted ${new Date(r.publishedDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                  </span>
                </span>
                {r.sameRole && <Pill variant="positive">This role</Pill>}
                {r.official && <Pill variant="neutral">Company board</Pill>}
                <ArrowUpRight className="h-4 w-4 flex-none text-black/35 transition-colors group-hover:text-primary" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        {search.openRoles.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full cursor-pointer border-t border-black/8 px-5 py-2.5 text-left text-xs font-semibold text-black/55 transition-colors hover:bg-[#fbfbf7] hover:text-primary">
            {showAll ? "Show fewer" : `Show all ${search.openRoles.length}`}
          </button>
        )}
      </DashCard>
    </section>
  );
};

const ReachingCompany: FC<{ search: ReferralSearchItem; company: string }> = ({ search, company }) => {
  const { emailFormat, inboxes, companyPhone } = search;
  if (!emailFormat && inboxes.length === 0 && !companyPhone) return null;
  // One mention per site: two pages from the same site are one source, not two.
  const formatSources = emailFormat ? emailFormat.sources.filter((source, i, all) => all.findIndex((s) => hostOf(s) === hostOf(source)) === i) : [];

  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-primary">Reaching {company}</h3>
      <DashCard className="flex flex-col gap-3.5 p-5">
        {emailFormat && (
          <p className="text-sm leading-relaxed text-black/65">
            Work emails here usually look like <span className="font-bold text-primary">{emailFormat.example}</span> (
            {EMAIL_PATTERN_LABELS[emailFormat.pattern] ?? emailFormat.pattern}
            {emailFormat.share !== null && `, ${emailFormat.share}% of addresses`}), according to{" "}
            {formatSources.slice(0, 3).map((source, i) => (
              <Fragment key={source}>
                {i > 0 && ", "}
                <a href={source} target="_blank" rel="noreferrer noopener" className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                  {hostOf(source)}
                </a>
              </Fragment>
            ))}
            . The &ldquo;likely&rdquo; emails above are built from it and aren&apos;t verified.
          </p>
        )}
        {(inboxes.length > 0 || companyPhone) && (
          <div className="flex flex-wrap items-center gap-2">
            {inboxes.map((inbox) => (
              <a
                key={inbox.email}
                href={`mailto:${inbox.email}`}
                title={`Listed on ${hostOf(inbox.source)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors hover:border-[#222325] hover:text-primary">
                <Mail className="h-3 w-3" aria-hidden />
                {inbox.email}
              </a>
            ))}
            {companyPhone && (
              <a
                href={`tel:${companyPhone.number}`}
                title={`Listed on ${hostOf(companyPhone.source)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors hover:border-[#222325] hover:text-primary">
                <Phone className="h-3 w-3" aria-hidden />
                {companyPhone.number}
              </a>
            )}
          </div>
        )}
      </DashCard>
    </section>
  );
};

export default WebReferrals;
