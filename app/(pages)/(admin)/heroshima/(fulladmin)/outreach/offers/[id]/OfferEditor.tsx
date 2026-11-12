"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { archiveOffer, createOffer, updateOffer } from "@/libs/mail-admin";
import { BILLING_INTERVALS, PAID_PLAN_KEYS, type MailOffer, type OfferDuration, type OfferInput } from "@/app/lib/mail/types";
import { BTN_DANGER, BTN_PRIMARY, ChipPicker, ErrorBox, Field, INPUT, Notice, Segmented } from "@/app/components/mail/ui";
import { numOrUndef } from "@/app/components/mail/format";

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

/** An offer's terms: discount, how long it applies, how long a code lasts, plans, monthly cap. */
const OfferEditor: FC<{ offer: MailOffer | null; maxDiscountPercent: number }> = ({ offer, maxDiscountPercent }) => {
  const router = useRouter();
  const [form, setForm] = useState<OfferInput>(() => inputOf(offer));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, start] = useTransition();
  const set = <K extends keyof OfferInput>(key: K, value: OfferInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const newVersion = Boolean(offer) && termsKey(form) !== termsKey(inputOf(offer));

  const problem = (): string | null => {
    if (!form.name.trim()) return "Give it a name.";
    if (form.kind === "percent" && !(Number(form.percentOff) >= 1 && Number(form.percentOff) <= Math.min(100, maxDiscountPercent)))
      return `The percentage must be 1 to ${Math.min(100, maxDiscountPercent)} (the highest discount in Outreach settings).`;
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
      else router.push("/heroshima/outreach/offers");
    });

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-md border border-gray-300 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name (only admins see it)" className="md:col-span-2">
          <input className={INPUT} value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="Plan discount" required />
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-600">Discount</p>
          <Segmented
            label="Discount kind"
            value={form.kind}
            onChange={(kind) => set("kind", kind)}
            options={[
              { value: "percent", label: "Percentage" },
              { value: "amount", label: "Amount off" },
            ]}
          />
          {form.kind === "percent" ? (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={Math.min(100, maxDiscountPercent)}
                aria-label="Percent off"
                className={`${INPUT} w-24 tabular-nums`}
                value={form.percentOff ?? ""}
                onChange={(e) => set("percentOff", numOrUndef(e.target.value) ?? null)}
              />
              % off <span className="text-xs text-gray-500">(at most {maxDiscountPercent}%)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              $
              <input
                type="number"
                min={0.01}
                step={0.01}
                aria-label="Amount off in dollars"
                className={`${INPUT} w-28 tabular-nums`}
                value={form.amountOffCents === null ? "" : form.amountOffCents / 100}
                onChange={(e) => {
                  const v = numOrUndef(e.target.value);
                  set("amountOffCents", v === undefined ? null : Math.round(v * 100));
                }}
              />
              off
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Field label="On the bill for">
            <select className={INPUT} value={form.duration} onChange={(e) => set("duration", e.target.value as OfferDuration)}>
              <option value="once">First payment only</option>
              <option value="repeating">First N months</option>
              <option value="forever">Every payment</option>
            </select>
          </Field>
          {form.duration === "repeating" ? (
            <div className="flex items-center gap-2 text-sm">
              First
              <input
                type="number"
                min={1}
                max={36}
                aria-label="Months"
                className={`${INPUT} w-20 tabular-nums`}
                value={form.durationMonths ?? ""}
                onChange={(e) => set("durationMonths", numOrUndef(e.target.value) ?? null)}
              />
              months
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-600">Code valid for</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              aria-label="Valid for hours"
              className={`${INPUT} w-24 tabular-nums`}
              value={form.validHours || ""}
              onChange={(e) => set("validHours", numOrUndef(e.target.value) ?? 0)}
            />
            hours
            {[24, 48, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => set("validHours", h)}
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${form.validHours === h ? "border-black bg-black text-[#e1f073]" : "border-gray-300 text-gray-600 hover:border-black"}`}>
                {h === 168 ? "7 days" : `${h} h`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">From when the mail is sent. Stripe enforces the expiry.</p>
        </div>

        <Field label="Most codes a month (empty: no cap)">
          <input
            type="number"
            min={1}
            className={`${INPUT} w-32 tabular-nums`}
            value={form.monthlyCap ?? ""}
            onChange={(e) => set("monthlyCap", numOrUndef(e.target.value) ?? null)}
          />
        </Field>

        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Plans (none = all)</p>
          <ChipPicker label="Plans" values={form.plans} options={PLAN_OPTIONS} onChange={(v) => set("plans", v)} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Billing periods (none = all)</p>
          <ChipPicker label="Billing periods" values={form.intervals} options={INTERVAL_OPTIONS} onChange={(v) => set("intervals", v)} />
        </div>
      </div>

      {newVersion ? <Notice tone="warn">Saving makes version {(offer?.version ?? 1) + 1}. Codes already sent keep the terms their mail promised.</Notice> : null}
      <p className="text-xs text-gray-500">Always: never for people already paying, one offer per person every 90 days, accounts at least 3 days old.</p>
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {offer ? "Save" : "Create offer"}
        </button>
        {note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
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
    </form>
  );
};

export default OfferEditor;
