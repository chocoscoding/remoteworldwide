"use client";

import { useRef, useState, useTransition, type CSSProperties, type FC, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { archiveOffer, createOffer, updateOffer } from "@/libs/mail-admin";
import {
  ACCENT_COLORS,
  ACCENT_LABELS,
  BILLING_INTERVALS,
  DEFAULT_OFFER_LOOK,
  MAIL_ACCENTS,
  OFFER_BOX_STYLES,
  OFFER_BOX_STYLE_LABELS,
  OFFER_PATH_MAX,
  OFFER_PATH_PATTERN,
  OFFER_VALID_HOURS_MAX,
  PAID_PLAN_KEYS,
  type MailDesign,
  type MailOffer,
  type OfferDuration,
  type OfferInput,
  type OfferKind,
  type OfferLink,
  type OfferLook,
} from "@/app/lib/mail/types";
import OfferSample from "@/app/components/mail/content/OfferSample";
import Fold from "@/app/components/mail/content/Fold";
import { OFFERS_HREF } from "@/app/components/mail/content/blocks";
import { BTN_DANGER, BTN_PRIMARY, Chip, ErrorBox, INPUT_SM, Notice, Switch } from "@/app/components/mail/ui";
import { numOrUndef, offerLabel } from "@/app/components/mail/format";
import { cn } from "@/lib/utils";

/** A stored link as the form holds it: `path` only with kind "path" (an older backend sends none: the billing page). */
const linkOf = (link: OfferLink | null | undefined): OfferLink =>
  link?.kind === "path" ? { kind: "path", path: link.path ?? "/" } : { kind: link?.kind === "pricing" ? "pricing" : "billing" };
const lookOf = (look: OfferLook | null | undefined): OfferLook => ({
  style: look?.style ?? DEFAULT_OFFER_LOOK.style,
  accent: look?.accent ?? null,
  countdown: Boolean(look?.countdown),
});

const inputOf = (o: MailOffer | null): OfferInput =>
  o
    ? {
        name: o.name,
        kind: o.kind,
        percentOff: o.percentOff,
        amountOffCents: o.amountOffCents,
        duration: o.duration,
        durationMonths: o.durationMonths,
        validHours: o.validHours,
        plans: o.plans ?? [],
        intervals: o.intervals ?? [],
        monthlyCap: o.monthlyCap,
        link: linkOf(o.link),
        look: lookOf(o.look),
      }
    : {
        name: "",
        kind: "percent",
        percentOff: 20,
        amountOffCents: null,
        duration: "once",
        durationMonths: null,
        validHours: 72,
        plans: [],
        intervals: [],
        monthlyCap: null,
        link: linkOf(null),
        look: lookOf(null),
      };

// The Stripe terms: a change to these saves as a new version. Link and look are presentation.
const termsKey = (f: OfferInput) => JSON.stringify([f.kind, f.kind === "percent" ? f.percentOff : f.amountOffCents, f.duration, f.duration === "repeating" ? f.durationMonths : null]);

const PLAN_OPTIONS = PAID_PLAN_KEYS.map((p) => ({ value: p as string, label: p[0].toUpperCase() + p.slice(1) }));
const INTERVAL_OPTIONS = BILLING_INTERVALS.map((i) => ({ value: i as string, label: i === "month" ? "Monthly" : i === "quarter" ? "Quarterly" : "Yearly" }));
const HOUR_PRESETS = [24, 48, 72, 168];
const LINK_OPTIONS: ReadonlyArray<{ value: OfferLink["kind"]; label: string }> = [
  { value: "billing", label: "Billing page" },
  { value: "pricing", label: "Pricing page" },
  { value: "path", label: "Another page" },
];
/** "Match the mail": every accent at once, since the mail decides. */
const MATCH_SWATCH = `conic-gradient(${MAIL_ACCENTS.map((a, i) => `${ACCENT_COLORS[a].fill} ${(i * 100) / MAIL_ACCENTS.length}% ${((i + 1) * 100) / MAIL_ACCENTS.length}%`).join(", ")})`;
const PATH_PROBLEM = "The page must be a path on the site, like /pricing.";

type Field = "name" | "discount" | "months" | "hours" | "path";

/** What is wrong with the form, field by field. */
function problemsOf(f: OfferInput, ceiling: number): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  if (!f.name.trim()) out.name = "Give it a name.";
  if (f.kind === "percent") {
    const p = Number(f.percentOff);
    if (f.percentOff === null || !(p >= 1)) out.discount = "Set the discount.";
    else if (p > ceiling) out.discount = `At most ${ceiling}%, the highest discount in Outreach settings.`;
  } else if (!(Number(f.amountOffCents) >= 1)) out.discount = "Set the amount off.";
  const months = Number(f.durationMonths);
  if (f.duration === "repeating" && !(Number.isInteger(months) && months >= 1 && months <= 36)) out.months = "Say for how many months, 1 to 36.";
  const hours = Number(f.validHours);
  if (!(Number.isInteger(hours) && hours >= 1 && hours <= OFFER_VALID_HOURS_MAX)) out.hours = `A code is valid for 1 to ${OFFER_VALID_HOURS_MAX.toLocaleString("en-GB")} hours.`;
  if (f.link.kind === "path") {
    const path = (f.link.path ?? "").trim();
    if (path.length < 2 || path.length > OFFER_PATH_MAX || !OFFER_PATH_PATTERN.test(path)) out.path = PATH_PROBLEM;
  }
  return out;
}

/** What the path box holds: the path without its leading "/" (shown as a fixed prefix). */
const pathTextOf = (link: OfferLink) => (link.kind === "path" ? (link.path ?? "").replace(/^\//, "") : "");
/** A typed or pasted page as a path: a full address of the site keeps only its path. */
const pathFrom = (text: string) => `/${text.replace(/^\s*https?:\/\/[^/]+/i, "").replace(/^\/+/, "")}`;

/**
 * One offer: on the left as it looks in a mail (re-rendered from the form), on the right its rules
 * as one column of short rows. A change to the discount or what it applies to saves as a new
 * version; codes already sent keep their terms. Where the button goes and how the box looks are
 * presentation and edit in place.
 */
const OfferEditor: FC<{ offer: MailOffer | null; maxDiscountPercent: number; brandDesign: MailDesign | null }> = ({ offer, maxDiscountPercent, brandDesign }) => {
  const router = useRouter();
  const [form, setForm] = useState<OfferInput>(() => inputOf(offer));
  const [saved, setSaved] = useState(() => JSON.stringify(inputOf(offer)));
  const [custom, setCustom] = useState(() => !HOUR_PRESETS.includes(inputOf(offer).validHours));
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, start] = useTransition();
  const nameField = useRef<HTMLInputElement>(null);
  const pathField = useRef<HTMLInputElement>(null);
  // The last path typed, so Billing then Another page brings it back.
  const lastPath = useRef(form.link.kind === "path" ? (form.link.path ?? "/") : "/");

  const set = <K extends keyof OfferInput>(key: K, value: OfferInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setLook = (change: Partial<OfferLook>) => setForm((f) => ({ ...f, look: { ...f.look, ...change } }));
  const ceiling = Math.min(100, maxDiscountPercent);
  const newVersion = Boolean(offer) && termsKey(form) !== termsKey(inputOf(offer));
  const dirty = JSON.stringify(form) !== saved;
  const pathText = pathTextOf(form.link);

  // Wrong values show as soon as they are typed; empty ones only once Save was pressed.
  const problems = problemsOf(form, ceiling);
  const typed: Record<Field, boolean> = {
    name: Boolean(form.name.trim()),
    discount: form.kind === "percent" ? form.percentOff !== null : form.amountOffCents !== null,
    months: form.durationMonths !== null,
    hours: Boolean(form.validHours),
    path: Boolean(pathText),
  };
  const shown = (field: Field) => (tried || typed[field] ? problems[field] : undefined);

  const chooseLink = (kind: OfferLink["kind"]) => {
    if (kind === "path") {
      set("link", { kind, path: lastPath.current });
      requestAnimationFrame(() => pathField.current?.focus());
    } else set("link", { kind });
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (Object.keys(problems).length) {
      if (problems.name) nameField.current?.focus();
      return;
    }
    const input: OfferInput = {
      ...form,
      name: form.name.trim(),
      percentOff: form.kind === "percent" ? Number(form.percentOff) : null,
      amountOffCents: form.kind === "amount" ? Math.round(Number(form.amountOffCents)) : null,
      durationMonths: form.duration === "repeating" ? Math.round(Number(form.durationMonths)) : null,
      validHours: Math.round(Number(form.validHours)),
      monthlyCap: form.monthlyCap ? Math.round(form.monthlyCap) : null,
      link: form.link.kind === "path" ? { kind: "path", path: (form.link.path ?? "").trim().replace(/\?$/, "") } : { kind: form.link.kind },
      look: { style: form.look.style, accent: form.look.accent, countdown: form.look.countdown },
    };
    start(async () => {
      setError(null);
      setNote(null);
      const res = offer ? await updateOffer(offer.id, input) : await createOffer(input);
      if (res.error || !res.data) {
        setError(res.error ?? "Not saved.");
        return;
      }
      setSaved(JSON.stringify(form));
      setTried(false);
      setNote(newVersion ? `Saved as version ${res.data.version ?? ""}.` : "Saved.");
      if (!offer) router.replace(`/heroshima/outreach/offers/${res.data.id}`);
      else router.refresh();
    });
  };

  const archive = () =>
    offer &&
    start(async () => {
      const res = await archiveOffer(offer.id);
      if (res.error) setError(res.error);
      else router.push(OFFERS_HREF);
    });

  const nameProblem = shown("name");
  const accentName = form.look.accent ? ACCENT_LABELS[form.look.accent] : "Match the mail";

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <header className="mb-1 flex min-w-0 flex-col gap-1">
        <h1 className="sr-only">{offer?.name || "New offer"}</h1>
        <input
          ref={nameField}
          aria-label="Offer name"
          aria-invalid={Boolean(nameProblem)}
          value={form.name}
          maxLength={120}
          placeholder="Name this offer"
          onChange={(e) => set("name", e.target.value)}
          className={cn(
            "-mx-1.5 w-full max-w-2xl rounded-md border bg-transparent px-1.5 py-0.5 text-2xl font-bold placeholder:text-gray-400 focus:outline-none",
            nameProblem ? "border-[#b23c26]" : "border-transparent hover:border-gray-300 focus:border-black",
          )}
        />
        {nameProblem ? <p className="text-xs text-[#b23c26]">{nameProblem}</p> : null}
        {offer ? (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            Version {offer.version}
            {offer.archived ? <Chip tone="gray">Archived</Chip> : null}
          </p>
        ) : null}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
        <section aria-label="The offer in a mail" className="min-w-0">
          <OfferSample discount={offerLabel(form)} validHours={Number(form.validHours) || 0} look={form.look} link={form.link} brandDesign={brandDesign} />
        </section>

        <section aria-label="Rules" className="flex min-w-0 flex-col rounded-md border border-gray-300 bg-white">
          <div className="divide-y divide-gray-200 px-4">
            <Row label="Discount" problem={shown("discount") ?? shown("months")}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {form.kind === "percent" ? (
                  <input
                    type="number"
                    min={1}
                    max={ceiling}
                    aria-label="Percent off"
                    aria-invalid={Boolean(shown("discount"))}
                    className={cn(INPUT_SM, "w-16 tabular-nums")}
                    value={form.percentOff ?? ""}
                    onChange={(e) => set("percentOff", numOrUndef(e.target.value) ?? null)}
                  />
                ) : (
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    aria-label="Dollars off"
                    aria-invalid={Boolean(shown("discount"))}
                    className={cn(INPUT_SM, "w-20 tabular-nums")}
                    value={form.amountOffCents === null ? "" : form.amountOffCents / 100}
                    onChange={(e) => {
                      const v = numOrUndef(e.target.value);
                      set("amountOffCents", v === undefined ? null : Math.round(v * 100));
                    }}
                  />
                )}
                <select aria-label="Percent or dollars" className={cn(INPUT_SM, "pr-7")} value={form.kind} onChange={(e) => set("kind", e.target.value as OfferKind)}>
                  <option value="percent">% off</option>
                  <option value="amount">$ off</option>
                </select>
                <span className="text-gray-500">on</span>
                <select aria-label="On which payments" className={cn(INPUT_SM, "pr-7")} value={form.duration} onChange={(e) => set("duration", e.target.value as OfferDuration)}>
                  <option value="once">the first payment</option>
                  <option value="repeating">the first months</option>
                  <option value="forever">every payment</option>
                </select>
                {form.duration === "repeating" ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={36}
                      aria-label="Months"
                      aria-invalid={Boolean(shown("months"))}
                      className={cn(INPUT_SM, "w-14 tabular-nums")}
                      value={form.durationMonths ?? ""}
                      onChange={(e) => set("durationMonths", numOrUndef(e.target.value) ?? null)}
                    />
                    <span>months</span>
                  </span>
                ) : null}
              </div>
            </Row>

            <Row label="Valid for" problem={shown("hours")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <div role="radiogroup" aria-label="Valid for" className="flex flex-wrap gap-1.5">
                  {HOUR_PRESETS.map((h) => (
                    <Choice
                      key={h}
                      on={!custom && form.validHours === h}
                      onClick={() => {
                        setCustom(false);
                        set("validHours", h);
                      }}>
                      {h === 168 ? "7 days" : `${h} h`}
                    </Choice>
                  ))}
                  <Choice on={custom} onClick={() => setCustom(true)}>
                    Custom
                  </Choice>
                </div>
                {custom ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <input
                      type="number"
                      min={1}
                      max={OFFER_VALID_HOURS_MAX}
                      aria-label="Valid for, in hours"
                      aria-invalid={Boolean(shown("hours"))}
                      className={cn(INPUT_SM, "w-20 tabular-nums")}
                      value={form.validHours || ""}
                      onChange={(e) => set("validHours", numOrUndef(e.target.value) ?? 0)}
                    />
                    <span>hours</span>
                  </span>
                ) : null}
              </div>
            </Row>

            <Row label="For">
              <div className="flex flex-wrap items-center gap-1.5">
                <AnyChips label="Plans" any="Any plan" values={form.plans} options={PLAN_OPTIONS} onChange={(v) => set("plans", v)} />
                <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />
                <AnyChips label="Billing" any="Any billing" values={form.intervals} options={INTERVAL_OPTIONS} onChange={(v) => set("intervals", v)} />
              </div>
            </Row>

            <Row label="Button goes to" problem={shown("path")}>
              <div className="flex flex-col gap-2">
                <div role="radiogroup" aria-label="Button goes to" className="flex flex-wrap gap-1.5">
                  {LINK_OPTIONS.map((o) => (
                    <Choice key={o.value} on={form.link.kind === o.value} onClick={() => chooseLink(o.value)}>
                      {o.label}
                    </Choice>
                  ))}
                </div>
                {form.link.kind === "path" ? (
                  <span
                    className={cn(
                      "flex w-full max-w-xs items-center rounded-md border bg-white text-sm",
                      shown("path") ? "border-[#b23c26]" : "border-gray-300 focus-within:border-black",
                    )}>
                    <span aria-hidden className="pl-2 text-gray-500">
                      /
                    </span>
                    <input
                      ref={pathField}
                      aria-label="Page on the site"
                      aria-invalid={Boolean(shown("path"))}
                      className="min-w-0 flex-1 rounded-md bg-transparent py-1 pl-0.5 pr-2 focus:outline-none"
                      value={pathText}
                      maxLength={OFFER_PATH_MAX}
                      placeholder="pricing"
                      spellCheck={false}
                      onChange={(e) => {
                        const path = pathFrom(e.target.value);
                        lastPath.current = path;
                        set("link", { kind: "path", path });
                      }}
                    />
                  </span>
                ) : null}
              </div>
            </Row>

            <Row label="Look">
              <div className="flex flex-col gap-2.5">
                <div role="radiogroup" aria-label="Box style" className="flex flex-wrap gap-1.5">
                  {OFFER_BOX_STYLES.map((s) => (
                    <Choice key={s} on={form.look.style === s} onClick={() => setLook({ style: s })}>
                      {OFFER_BOX_STYLE_LABELS[s]}
                    </Choice>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div role="radiogroup" aria-label="Box accent" className="flex items-center gap-2">
                    <Swatch on={form.look.accent === null} label="Match the mail" style={{ background: MATCH_SWATCH }} onClick={() => setLook({ accent: null })} />
                    {MAIL_ACCENTS.map((a) => (
                      <Swatch
                        key={a}
                        on={form.look.accent === a}
                        label={ACCENT_LABELS[a]}
                        style={{ background: ACCENT_COLORS[a].fill, borderColor: ACCENT_COLORS[a].edge }}
                        onClick={() => setLook({ accent: a })}
                      />
                    ))}
                    <span className="ml-1 text-[11px] text-gray-500">{accentName}</span>
                  </div>
                  <span className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <Switch checked={form.look.countdown} onChange={(on) => setLook({ countdown: on })} label="Countdown" />
                    Countdown
                  </span>
                </div>
              </div>
            </Row>

            <div className="py-2">
              <Fold variant="line" title="More" summary={form.monthlyCap ? `At most ${form.monthlyCap} codes a month` : "No monthly cap"}>
                <div className="flex flex-col gap-2 pl-6">
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <span>At most</span>
                    <input
                      type="number"
                      min={1}
                      className={cn(INPUT_SM, "w-20 tabular-nums")}
                      value={form.monthlyCap ?? ""}
                      placeholder="any"
                      onChange={(e) => set("monthlyCap", numOrUndef(e.target.value) ?? null)}
                    />
                    <span>codes a month, across everyone</span>
                  </label>
                  <p className="text-[11px] text-gray-500">Not per person. A campaign that reaches the cap pauses until you raise it.</p>
                  <p className="text-[11px] text-gray-500">Always on: never for people already paying, one offer per person every 90 days, accounts at least 3 days old.</p>
                </div>
              </Fold>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 p-4">
            {newVersion ? <Notice tone="warn">Saving makes version {(offer?.version ?? 1) + 1}. Codes already sent keep their terms.</Notice> : null}
            {error ? <ErrorBox>{error}</ErrorBox> : null}
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={busy || (!dirty && Boolean(offer))} className={BTN_PRIMARY}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {offer ? "Save" : "Create offer"}
              </button>
              {dirty && offer ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
              {offer && !offer.archived ? (
                <span className="ml-auto flex items-center gap-2">
                  {confirmArchive ? (
                    <>
                      <span className="text-xs text-gray-600">No new codes are given from it.</span>
                      <button type="button" onClick={archive} disabled={busy} className="rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                        Yes, archive
                      </button>
                      <button type="button" onClick={() => setConfirmArchive(false)} className="px-2 text-xs font-semibold text-gray-500">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmArchive(true)} className={BTN_DANGER}>
                      Archive
                    </button>
                  )}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </form>
  );
};

/** One rule: its name on the left, the control on the right, and what is wrong with it (only then). */
const Row: FC<{ label: string; problem?: string; children: ReactNode }> = ({ label, problem, children }) => (
  <div className="grid gap-1.5 py-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start sm:gap-3">
    <p className="text-xs font-semibold text-gray-600 sm:pt-1.5">{label}</p>
    <div className="min-w-0">
      {children}
      {problem ? (
        <p role="alert" className="mt-1.5 text-xs text-[#b23c26]">
          {problem}
        </p>
      ) : null}
    </div>
  </div>
);

/** One of a few choices, as a chip. */
const Choice: FC<{ on: boolean; onClick: () => void; children: ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    onClick={onClick}
    className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black")}>
    {children}
  </button>
);

/** Any of a few values, with an "Any ..." chip that is on while none is picked (and clears them). */
const AnyChips: FC<{ label: string; any: string; values: string[]; options: ReadonlyArray<{ value: string; label: string }>; onChange: (values: string[]) => void }> = ({
  label,
  any,
  values,
  options,
  onChange,
}) => {
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-1 text-xs font-semibold", on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black");
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={!values.length} onClick={() => onChange([])} className={chip(!values.length)}>
        {any}
      </button>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])} className={chip(on)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

/** An accent to pick: a round swatch, ringed when picked. */
const Swatch: FC<{ on: boolean; label: string; style: CSSProperties; onClick: () => void }> = ({ on, label, style, onClick }) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    aria-label={label}
    title={label}
    onClick={onClick}
    className={cn("block h-6 w-6 flex-none rounded-full border-2 border-[#222325]", on ? "ring-2 ring-black ring-offset-2" : "hover:ring-1 hover:ring-gray-400 hover:ring-offset-1")}
    style={style}
  />
);

export default OfferEditor;
