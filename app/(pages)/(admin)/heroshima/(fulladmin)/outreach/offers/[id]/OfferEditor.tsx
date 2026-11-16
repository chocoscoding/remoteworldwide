"use client";

import { useState, useTransition, type FC, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { archiveOffer, createOffer, updateOffer } from "@/libs/mail-admin";
import { BILLING_INTERVALS, PAID_PLAN_KEYS, type MailDesign, type MailOffer, type OfferDuration, type OfferInput } from "@/app/lib/mail/types";
import OfferSample from "@/app/components/mail/content/OfferSample";
import { OFFERS_HREF } from "@/app/components/mail/content/blocks";
import { BTN_DANGER, BTN_PRIMARY, ChipPicker, ErrorBox, INPUT, INPUT_SM, Notice, Segmented } from "@/app/components/mail/ui";
import { numOrUndef, offerLabel } from "@/app/components/mail/format";
import { cn } from "@/lib/utils";

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
      }
    : { name: "", kind: "percent", percentOff: 20, amountOffCents: null, duration: "once", durationMonths: null, validHours: 72, plans: [], intervals: [], monthlyCap: null };

const termsKey = (f: OfferInput) => JSON.stringify([f.kind, f.kind === "percent" ? f.percentOff : f.amountOffCents, f.duration, f.duration === "repeating" ? f.durationMonths : null]);

const PLAN_OPTIONS = PAID_PLAN_KEYS.map((p) => ({ value: p as string, label: p[0].toUpperCase() + p.slice(1) }));
const INTERVAL_OPTIONS = BILLING_INTERVALS.map((i) => ({ value: i as string, label: i === "month" ? "Monthly" : i === "quarter" ? "Quarterly" : "Yearly" }));
const HOUR_PRESETS = [24, 48, 72, 168];

/**
 * One offer: on the left as it looks in a mail, on the right its rules in one compact form
 * (discount, how long it applies, how long a code lasts, plans, monthly cap). A change to the
 * discount or its duration saves as a new version; codes already sent keep their terms.
 */
const OfferEditor: FC<{ offer: MailOffer | null; maxDiscountPercent: number; brandDesign: MailDesign | null }> = ({ offer, maxDiscountPercent, brandDesign }) => {
  const router = useRouter();
  const [form, setForm] = useState<OfferInput>(() => inputOf(offer));
  const [saved, setSaved] = useState(() => JSON.stringify(inputOf(offer)));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, start] = useTransition();
  const set = <K extends keyof OfferInput>(key: K, value: OfferInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const newVersion = Boolean(offer) && termsKey(form) !== termsKey(inputOf(offer));
  const dirty = JSON.stringify(form) !== saved;
  const ceiling = Math.min(100, maxDiscountPercent);

  const problem = (): string | null => {
    if (!form.name.trim()) return "Give it a name.";
    if (form.kind === "percent" && !(Number(form.percentOff) >= 1 && Number(form.percentOff) <= ceiling))
      return `The percentage must be 1 to ${ceiling} (the highest discount in Outreach settings).`;
    if (form.kind === "amount" && !(Number(form.amountOffCents) >= 1)) return "Set the amount off.";
    if (form.duration === "repeating" && !(Number(form.durationMonths) >= 1)) return "Set how many months.";
    if (!(Number(form.validHours) >= 1)) return "A code must be valid for at least 1 hour.";
    return null;
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const issue = problem();
    if (issue) {
      setError(issue);
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

  return (
    <form onSubmit={save} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
      <section aria-label="In a mail" className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-bold">In a mail</h2>
        <OfferSample discount={offerLabel(form)} brandDesign={brandDesign} />
      </section>

      <section aria-label="Rules" className="flex min-w-0 flex-col rounded-md border border-gray-300 bg-white lg:sticky lg:top-4">
        <h2 className="px-4 pb-1 pt-4 text-sm font-bold">Rules</h2>
        <div className="divide-y divide-gray-200 px-4">
          <Row label="Name">
            <input className={INPUT} value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="Only admins see it" required />
          </Row>
          <Row label="Discount">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Segmented
                label="Discount kind"
                value={form.kind}
                onChange={(kind) => set("kind", kind)}
                options={[
                  { value: "percent", label: "Percent" },
                  { value: "amount", label: "Amount" },
                ]}
              />
              {form.kind === "percent" ? (
                <>
                  <input
                    type="number"
                    min={1}
                    max={ceiling}
                    aria-label="Percent off"
                    className={`${INPUT_SM} w-20 tabular-nums`}
                    value={form.percentOff ?? ""}
                    onChange={(e) => set("percentOff", numOrUndef(e.target.value) ?? null)}
                  />
                  <span>% off</span>
                  <span className="text-[11px] text-gray-500">at most {maxDiscountPercent}%</span>
                </>
              ) : (
                <>
                  <span>$</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    aria-label="Amount off in dollars"
                    className={`${INPUT_SM} w-24 tabular-nums`}
                    value={form.amountOffCents === null ? "" : form.amountOffCents / 100}
                    onChange={(e) => {
                      const v = numOrUndef(e.target.value);
                      set("amountOffCents", v === undefined ? null : Math.round(v * 100));
                    }}
                  />
                  <span>off</span>
                </>
              )}
            </div>
          </Row>
          <Row label="On the bill for">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select aria-label="On the bill for" className={`${INPUT_SM} pr-7`} value={form.duration} onChange={(e) => set("duration", e.target.value as OfferDuration)}>
                <option value="once">The first payment</option>
                <option value="repeating">The first months</option>
                <option value="forever">Every payment</option>
              </select>
              {form.duration === "repeating" ? (
                <>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    aria-label="Months"
                    className={`${INPUT_SM} w-16 tabular-nums`}
                    value={form.durationMonths ?? ""}
                    onChange={(e) => set("durationMonths", numOrUndef(e.target.value) ?? null)}
                  />
                  <span>months</span>
                </>
              ) : null}
            </div>
          </Row>
          <Row label="Code valid for" hint="From when the mail is sent.">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <input
                type="number"
                min={1}
                aria-label="Valid for hours"
                className={`${INPUT_SM} w-20 tabular-nums`}
                value={form.validHours || ""}
                onChange={(e) => set("validHours", numOrUndef(e.target.value) ?? 0)}
              />
              <span className="mr-1">hours</span>
              {HOUR_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => set("validHours", h)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    form.validHours === h ? "border-black bg-black text-[#e1f073]" : "border-gray-300 text-gray-600 hover:border-black",
                  )}>
                  {h === 168 ? "7 days" : `${h} h`}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Plans" hint="None picked: every plan.">
            <ChipPicker label="Plans" values={form.plans} options={PLAN_OPTIONS} onChange={(v) => set("plans", v)} />
          </Row>
          <Row label="Billing" hint="None picked: every period.">
            <ChipPicker label="Billing periods" values={form.intervals} options={INTERVAL_OPTIONS} onChange={(v) => set("intervals", v)} />
          </Row>
          <Row label="Most a month" hint="Codes given in a month. Empty: no cap.">
            <input type="number" min={1} aria-label="Most codes a month" className={`${INPUT_SM} w-24 tabular-nums`} value={form.monthlyCap ?? ""} onChange={(e) => set("monthlyCap", numOrUndef(e.target.value) ?? null)} />
          </Row>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 p-4">
          {newVersion ? <Notice tone="warn">Saving makes version {(offer?.version ?? 1) + 1}. Codes already sent keep the terms their mail promised.</Notice> : null}
          <p className="text-[11px] text-gray-500">Always: never for people already paying, one offer per person every 90 days, accounts at least 3 days old.</p>
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
    </form>
  );
};

/** One rule: its name on the left, the control on the right. */
const Row: FC<{ label: string; hint?: string; children: ReactNode }> = ({ label, hint, children }) => (
  <div className="grid gap-1.5 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-3">
    <div>
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      {hint ? <p className="text-[11px] text-gray-500 sm:hidden">{hint}</p> : null}
    </div>
    <div className="min-w-0">
      {children}
      {hint ? <p className="mt-1 hidden text-[11px] text-gray-500 sm:block">{hint}</p> : null}
    </div>
  </div>
);

export default OfferEditor;
