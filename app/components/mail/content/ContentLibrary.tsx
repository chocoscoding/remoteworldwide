"use client";

import { useMemo, useState, type FC } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { MailDesign, MailOffer, MailTemplate } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { day, durationText, money, n, offerLabel } from "../format";
import { BTN, BTN_PRIMARY, Chip, Empty, ErrorBox, Segmented } from "../ui";
import MailThumb from "./MailThumb";
import OfferBox from "./OfferBox";
import { resolveDesign } from "./blocks";

type Show = "mails" | "offers";
type MailFilter = "all" | "offer" | "feedback" | "theo";

const FILTERS: ReadonlyArray<{ value: MailFilter; label: string; test: (t: MailTemplate) => boolean }> = [
  { value: "all", label: "All", test: () => true },
  { value: "offer", label: "With an offer", test: (t) => (t.blocks ?? []).some((b) => b.type === "offer") },
  { value: "feedback", label: "Feedback", test: (t) => Boolean(t.feedbackFooter) || (t.blocks ?? []).some((b) => b.type === "feedback") },
  { value: "theo", label: "From Theo", test: (t) => t.sender === "founder" },
];

/** "72 hours" or "3 days". */
const validFor = (h: number) => (h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`);
const plansText = (o: MailOffer) => (o.plans?.length ? o.plans.map((p) => p[0].toUpperCase() + p.slice(1)).join(", ") : "All plans");

/**
 * The content library: the mails (templates) and the offers they carry, side by side. Mails show a
 * small drawing of the mail; offers show the offer box as it reads in a mail.
 */
const ContentLibrary: FC<{
  templates: MailTemplate[];
  templatesError?: string;
  offers: MailOffer[];
  offersError?: string;
  brandDesign: MailDesign | null;
  archived: boolean;
  initialShow: Show;
}> = ({ templates, templatesError, offers, offersError, brandDesign, archived, initialShow }) => {
  const [show, setShow] = useState<Show>(initialShow);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MailFilter>("all");

  const switchTo = (next: Show) => {
    setShow(next);
    setQuery("");
    const params = new URLSearchParams(window.location.search);
    if (next === "offers") params.set("show", "offers");
    else params.delete("show");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const q = query.trim().toLowerCase();
  const shownOffers = useMemo(() => offers.filter((o) => Boolean(o.archived) === archived && (!q || o.name.toLowerCase().includes(q))), [offers, archived, q]);
  const searched = useMemo(() => templates.filter((t) => !q || `${t.name} ${t.subject}`.toLowerCase().includes(q)), [templates, q]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, searched.filter(f.test).length])) as Record<MailFilter, number>, [searched]);
  const shownMails = searched.filter(FILTERS.find((f) => f.value === filter)!.test);

  const archivedHref = `/heroshima/outreach/templates?${new URLSearchParams({ ...(show === "offers" ? { show: "offers" } : {}), ...(archived ? {} : { archived: "1" }) }).toString()}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Content"
          value={show}
          onChange={switchTo}
          options={[
            { value: "mails", label: `Mails${templates.length ? ` (${templates.length})` : ""}` },
            { value: "offers", label: `Offers${offers.length ? ` (${offers.filter((o) => Boolean(o.archived) === archived).length})` : ""}` },
          ]}
        />
        <label className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={show === "mails" ? "Search name or subject" : "Search offers"}
            aria-label={show === "mails" ? "Search mails" : "Search offers"}
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-7 pr-2 text-sm focus:border-black focus:outline-none"
          />
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href={archivedHref} className="text-xs font-semibold text-gray-600 hover:underline">
            {archived ? "Show current" : "Show archived"}
          </Link>
          <Link href="/heroshima/outreach/offers/new" className={show === "offers" ? BTN_PRIMARY : BTN}>
            New offer
          </Link>
          <Link href="/heroshima/outreach/templates/new" className={show === "mails" ? BTN_PRIMARY : BTN}>
            New mail
          </Link>
        </div>
      </div>

      {show === "mails" ? (
        <>
          <div role="group" aria-label="Filter mails" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                  filter === f.value ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black",
                )}>
                {f.label} <span className="tabular-nums opacity-70">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          {templatesError ? (
            <ErrorBox>The mails couldn&apos;t be loaded: {templatesError}</ErrorBox>
          ) : !templates.length ? (
            <Empty>{archived ? "No archived mails." : "No mails yet. Make one, or load the starter set from Playbooks."}</Empty>
          ) : !shownMails.length ? (
            <Empty>No mail matches.</Empty>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {shownMails.map((t) => (
                <li key={t.id}>
                  <MailCard template={t} design={resolveDesign(t.design, brandDesign)} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : offersError ? (
        <ErrorBox>The offers couldn&apos;t be loaded: {offersError}</ErrorBox>
      ) : !shownOffers.length ? (
        <Empty>{q ? "No offer matches." : archived ? "No archived offers." : "No offers yet. An offer is a personal discount a campaign or playbook step gives with its mail."}</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shownOffers.map((o) => (
            <li key={o.id}>
              <OfferCard offer={o} design={resolveDesign(null, brandDesign)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const MailCard: FC<{ template: MailTemplate; design: MailDesign }> = ({ template: t, design }) => {
  const usedBy = (t as MailTemplate & { usedBy?: number }).usedBy;
  const facts = [
    t.sender === "founder" ? "From Theo" : null,
    (t.blocks ?? []).some((b) => b.type === "offer") ? "Offer box" : null,
    typeof usedBy === "number" ? `Used by ${n(usedBy)}` : null,
    day(t.updatedAt ?? t.createdAt) ? `Updated ${day(t.updatedAt ?? t.createdAt)}` : null,
  ].filter(Boolean);
  return (
    <Link href={`/heroshima/outreach/templates/${t.id}`} className="group flex h-full flex-col overflow-hidden rounded-md bg-white br-plain-press">
      <MailThumb blocks={t.blocks ?? []} design={design} />
      <div className="flex flex-1 flex-col gap-0.5 border-t border-gray-200 px-3 py-2.5">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{t.name || "Untitled"}</span>
          {t.seedKey ? <Chip tone="outline">starter</Chip> : null}
        </p>
        <p className="truncate text-xs text-gray-600" title={t.subject}>
          {t.subject || "No subject yet"}
        </p>
        {facts.length ? <p className="mt-1 truncate text-[11px] text-gray-500">{facts.join(" · ")}</p> : null}
      </div>
    </Link>
  );
};

const OfferCard: FC<{ offer: MailOffer; design: MailDesign }> = ({ offer: o, design }) => (
  <Link href={`/heroshima/outreach/offers/${o.id}`} className="group flex h-full flex-col overflow-hidden rounded-md bg-white br-plain-press">
    <div className="bg-[#f9f8f1] px-4 py-4">
      <OfferBox design={design} size="sm" kicker="Your personal offer" headline={`${offerLabel(o)} off`} detail={`Code valid ${validFor(o.validHours)}`} button="Use my discount" />
    </div>
    <div className="flex flex-1 flex-col gap-0.5 border-t border-gray-200 px-3 py-2.5">
      <p className="flex items-center gap-1.5">
        <span className="truncate text-sm font-semibold">{o.name}</span>
        <Chip tone="outline">v{o.version}</Chip>
      </p>
      <p className="truncate text-xs text-gray-600">
        {durationText(o)} · {plansText(o)}
        {o.intervals?.length ? ` · ${o.intervals.join(", ")}` : ""}
      </p>
      <p className="mt-1 truncate text-[11px] text-gray-500">
        {o.monthlyCap ? `At most ${n(o.monthlyCap)} a month` : "No monthly cap"}
        {o.stats ? ` · ${n(o.stats.granted)} given · ${n(o.stats.redeemed)} redeemed · ${money(o.stats.revenueCents)}` : ""}
      </p>
    </div>
  </Link>
);

export default ContentLibrary;
