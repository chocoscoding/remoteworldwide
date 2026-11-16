"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { saveMailSettings } from "@/libs/mail-admin";
import {
  ACCENT_LABELS,
  BUTTON_SHAPE_LABELS,
  DEFAULT_DESIGN,
  DEFAULT_SETTINGS,
  LOOK_LABELS,
  MAIL_ACCENTS,
  MAIL_BUTTON_SHAPES,
  MAIL_LOOKS,
  type MailDesign,
  type MailSettings,
  type SettingsInput,
} from "@/app/lib/mail/types";
import Accordion from "@/app/components/mail/overview/Accordion";
import { BTN_PRIMARY, Chip, ErrorBox, Field, INPUT } from "@/app/components/mail/ui";
import { numOrUndef } from "@/app/components/mail/format";
import DesignPicker from "./DesignPicker";

// The Outreach settings, one section open at a time; a closed one says what it holds in a line.
// The marketing pause is the switch on the overview, so this form never sends `paused` (a stale
// value here must not undo a pause made there). Ranges are checked here and again by the backend.

type Form = Required<Omit<SettingsInput, "alarms" | "senders" | "paused">> & {
  // Alarm limits are typed as percentages here and stored as 0 to 1 rates.
  alarms: { complaintWarn: number; complaintPause: number; bounceWarn: number; bouncePause: number };
  senders: MailSettings["senders"];
};

type Section = "senders" | "design" | "caps" | "credit" | "alarms";

const toPct = (rate: number) => +(rate * 100).toFixed(3);
const toRate = (percent: number) => +(percent / 100).toFixed(6);

/** A stored design with every key known, unknown values back to the default. */
const designOf = (d: Partial<MailDesign> | null | undefined): MailDesign => ({
  look: d?.look && MAIL_LOOKS.includes(d.look) ? d.look : DEFAULT_DESIGN.look,
  accent: d?.accent && MAIL_ACCENTS.includes(d.accent) ? d.accent : DEFAULT_DESIGN.accent,
  button: d?.button && MAIL_BUTTON_SHAPES.includes(d.button) ? d.button : DEFAULT_DESIGN.button,
});

const formOf = (s: MailSettings): Form => {
  const d = DEFAULT_SETTINGS;
  const a = { ...d.alarms, ...(s.alarms ?? {}) };
  return {
    capPerDay: s.capPerDay ?? d.capPerDay,
    capPerWeek: s.capPerWeek ?? d.capPerWeek,
    quietStart: s.quietStart ?? d.quietStart,
    quietEnd: s.quietEnd ?? d.quietEnd,
    attributionDays: s.attributionDays ?? d.attributionDays,
    influenceDays: s.influenceDays ?? d.influenceDays,
    maxDiscountPercent: s.maxDiscountPercent ?? d.maxDiscountPercent,
    alarms: { complaintWarn: toPct(a.complaintWarn), complaintPause: toPct(a.complaintPause), bounceWarn: toPct(a.bounceWarn), bouncePause: toPct(a.bouncePause) },
    senders: {
      brand: { ...d.senders.brand, ...(s.senders?.brand ?? {}) },
      founder: { ...d.senders.founder, ...(s.senders?.founder ?? {}) },
    },
    replyDomain: s.replyDomain ?? "",
    design: designOf(s.design),
  };
};

/** What each section holds, to tell which ones have unsaved edits. */
const SLICE: Record<Section, (f: Form) => unknown> = {
  senders: (f) => [f.senders, f.replyDomain],
  design: (f) => f.design,
  caps: (f) => [f.capPerDay, f.capPerWeek, f.quietStart, f.quietEnd],
  credit: (f) => [f.attributionDays, f.influenceDays, f.maxDiscountPercent],
  alarms: (f) => f.alarms,
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;
const show = (v: number) => (Number.isFinite(v) ? String(v) : "?");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const summaries = (f: Form): Record<Section, string> => {
  const addresses = [f.senders.brand.email, f.senders.founder.email].filter(Boolean);
  return {
    senders: [
      `${f.senders.brand.name || "Brand"} and ${f.senders.founder.name || "founder"}`,
      addresses.length ? addresses.join(", ") : "default addresses",
      f.replyDomain ? `replies to ${f.replyDomain}` : "default reply domain",
    ].join(" · "),
    design: `${LOOK_LABELS[f.design.look]} look · ${ACCENT_LABELS[f.design.accent].toLowerCase()} accent · ${BUTTON_SHAPE_LABELS[f.design.button].toLowerCase()} buttons`,
    caps: `${show(f.capPerDay)} a day, ${show(f.capPerWeek)} a week, quiet ${hour(f.quietStart)} to ${hour(f.quietEnd)}`,
    credit: `Clicks credited for ${show(f.attributionDays)} d, deliveries for ${show(f.influenceDays)} d, discounts up to ${show(f.maxDiscountPercent)}%`,
    alarms: `Warn at ${show(f.alarms.complaintWarn)}% complaints, ${show(f.alarms.bounceWarn)}% bounces · pause at ${show(f.alarms.complaintPause)}%, ${show(f.alarms.bouncePause)}%`,
  };
};

/** The first problem, with the section it is in, so that section opens. */
const problemOf = (form: Form): { section: Section; message: string } | null => {
  const at = (section: Section, message: string) => ({ section, message });
  if (form.senders.brand.email && !EMAIL.test(form.senders.brand.email)) return at("senders", "The brand sender address isn't valid.");
  if (form.senders.founder.email && !EMAIL.test(form.senders.founder.email)) return at("senders", "The founder sender address isn't valid.");
  if (form.replyDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(form.replyDomain)) return at("senders", "The reply domain isn't valid (like reply.remoteworldwide.net).");
  if (!(form.capPerDay >= 1 && form.capPerDay <= 10)) return at("caps", "Mails a day: 1 to 10.");
  if (!(form.capPerWeek >= form.capPerDay && form.capPerWeek <= 30)) return at("caps", "Mails a week: at least the daily cap, at most 30.");
  if (!(form.attributionDays >= 1 && form.attributionDays <= 60)) return at("credit", "Click credit: 1 to 60 days.");
  if (!(form.influenceDays >= 0 && form.influenceDays <= 30)) return at("credit", "Delivery credit: 0 to 30 days.");
  if (!(form.maxDiscountPercent >= 1 && form.maxDiscountPercent <= 100)) return at("credit", "Highest discount: 1 to 100%.");
  const a = form.alarms;
  if (!(a.complaintWarn > 0 && a.complaintWarn < a.complaintPause && a.complaintPause <= 100)) return at("alarms", "Complaints: warn must be above 0 and below pause.");
  if (!(a.bounceWarn > 0 && a.bounceWarn < a.bouncePause && a.bouncePause <= 100)) return at("alarms", "Bounces: warn must be above 0 and below pause.");
  return null;
};

const SettingsForm: FC<{ settings: MailSettings }> = ({ settings }) => {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formOf(settings));
  const [saved, setSaved] = useState<Form>(() => formOf(settings));
  const [open, setOpen] = useState<string | null>("senders");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const edited = (s: Section) => JSON.stringify(SLICE[s](form)) !== JSON.stringify(SLICE[s](saved));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAlarm = (key: keyof Form["alarms"], value: number) => setForm((f) => ({ ...f, alarms: { ...f.alarms, [key]: value } }));
  const setSender = (who: "brand" | "founder", key: "name" | "email", value: string) =>
    setForm((f) => ({ ...f, senders: { ...f.senders, [who]: { ...f.senders[who], [key]: value } } }));

  const save = (event: FormEvent) => {
    event.preventDefault();
    const issue = problemOf(form);
    if (issue) {
      setError(issue.message);
      setOpen(issue.section);
      return;
    }
    const input: SettingsInput = {
      ...form,
      replyDomain: form.replyDomain.trim().toLowerCase(),
      alarms: {
        complaintWarn: toRate(form.alarms.complaintWarn),
        complaintPause: toRate(form.alarms.complaintPause),
        bounceWarn: toRate(form.alarms.bounceWarn),
        bouncePause: toRate(form.alarms.bouncePause),
      },
    };
    start(async () => {
      setError(null);
      setNote(null);
      const res = await saveMailSettings(input);
      if (res.error || !res.data) {
        setError(res.error ?? "Not saved.");
        return;
      }
      const next = formOf(res.data);
      setForm(next);
      setSaved(next);
      setNote("Saved.");
      router.refresh();
    });
  };

  const num = (value: number, onChange: (v: number) => void, props: { min?: number; max?: number; step?: number; label: string }) => (
    <input
      type="number"
      aria-label={props.label}
      min={props.min}
      max={props.max}
      step={props.step}
      className={`${INPUT} w-24 tabular-nums`}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(numOrUndef(e.target.value) ?? Number.NaN)}
    />
  );

  const hourSelect = (value: number, onChange: (h: number) => void, label: string) => (
    <select aria-label={label} className={`${INPUT} w-24`} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {hour(h)}
        </option>
      ))}
    </select>
  );

  const line = summaries(form);
  const flag = (s: Section) => (edited(s) ? <Chip tone="amber">Edited</Chip> : null);

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Accordion
        label="Outreach settings"
        open={open}
        onOpenChange={setOpen}
        items={[
          {
            key: "senders",
            title: "Senders and replies",
            summary: line.senders,
            flag: flag("senders"),
            content: (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brand name">
                  <input className={INPUT} value={form.senders.brand.name} maxLength={80} onChange={(e) => setSender("brand", "name", e.target.value)} />
                </Field>
                <Field label="Brand address" hint="Empty: marketing goes from the product sender.">
                  <input
                    type="email"
                    className={INPUT}
                    value={form.senders.brand.email}
                    maxLength={254}
                    onChange={(e) => setSender("brand", "email", e.target.value.trim())}
                    placeholder="hello@remoteworldwide.net"
                  />
                </Field>
                <Field label="Founder name">
                  <input className={INPUT} value={form.senders.founder.name} maxLength={80} onChange={(e) => setSender("founder", "name", e.target.value)} />
                </Field>
                <Field label="Founder address" hint="Empty: founder@remoteworldwide.net.">
                  <input
                    type="email"
                    className={INPUT}
                    value={form.senders.founder.email}
                    maxLength={254}
                    onChange={(e) => setSender("founder", "email", e.target.value.trim())}
                    placeholder="theo@remoteworldwide.net"
                  />
                </Field>
                <Field label="Reply domain" hint="Replies go to reply+<id>@ this domain and land in the Inbox. Empty: replies go to the sender's address as normal email." className="sm:col-span-2">
                  <input className={INPUT} value={form.replyDomain} maxLength={120} onChange={(e) => set("replyDomain", e.target.value.trim())} placeholder="reply.remoteworldwide.net" />
                </Field>
              </div>
            ),
          },
          {
            key: "design",
            title: "Design",
            summary: line.design,
            flag: flag("design"),
            content: <DesignPicker design={form.design} onChange={(d) => set("design", d)} />,
          },
          {
            key: "caps",
            title: "Not too much",
            summary: line.caps,
            flag: flag("caps"),
            content: (
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <Field label="Marketing mails a person, a day at most">{num(form.capPerDay, (v) => set("capPerDay", v), { min: 1, max: 10, label: "Per day" })}</Field>
                <Field label="A week at most">{num(form.capPerWeek, (v) => set("capPerWeek", v), { min: 1, max: 30, label: "Per week" })}</Field>
                <Field label="Quiet hours, their local time" hint="Nothing goes out in this window; it waits until it ends.">
                  <span className="flex items-center gap-2 text-sm font-normal text-black">
                    from {hourSelect(form.quietStart, (h) => set("quietStart", h), "Quiet from")} to {hourSelect(form.quietEnd, (h) => set("quietEnd", h), "Quiet until")}
                  </span>
                </Field>
              </div>
            ),
          },
          {
            key: "credit",
            title: "Credit and discounts",
            summary: line.credit,
            flag: flag("credit"),
            content: (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Credit a click for, days" hint="An upgrade this soon after a click is credited to the mail.">
                  {num(form.attributionDays, (v) => set("attributionDays", v), { min: 1, max: 60, label: "Click credit days" })}
                </Field>
                <Field label="Credit a delivery for, days" hint="Without a click, an upgrade this soon after delivery counts as influenced.">
                  {num(form.influenceDays, (v) => set("influenceDays", v), { min: 0, max: 30, label: "Delivery credit days" })}
                </Field>
                <Field label="Highest discount, %" hint="Offers and step overrides can't go above it.">
                  {num(form.maxDiscountPercent, (v) => set("maxDiscountPercent", v), { min: 1, max: 100, label: "Highest discount" })}
                </Field>
              </div>
            ),
          },
          {
            key: "alarms",
            title: "Alarms",
            summary: line.alarms,
            flag: flag("alarms"),
            content: (
              <div>
                <div role="group" aria-label="Alarm lines" className="inline-grid grid-cols-[auto_auto_auto] items-center gap-x-6 gap-y-2">
                  <span />
                  <span className="text-xs font-semibold text-gray-600">Warn at %</span>
                  <span className="text-xs font-semibold text-gray-600">Pause at %</span>
                  <span className="text-sm font-semibold">Complaints</span>
                  {num(form.alarms.complaintWarn, (v) => setAlarm("complaintWarn", v), { min: 0, step: 0.01, label: "Complaints warn at %" })}
                  {num(form.alarms.complaintPause, (v) => setAlarm("complaintPause", v), { min: 0, step: 0.01, label: "Complaints pause at %" })}
                  <span className="text-sm font-semibold">Bounces</span>
                  {num(form.alarms.bounceWarn, (v) => setAlarm("bounceWarn", v), { min: 0, step: 0.1, label: "Bounces warn at %" })}
                  {num(form.alarms.bouncePause, (v) => setAlarm("bouncePause", v), { min: 0, step: 0.1, label: "Bounces pause at %" })}
                </div>
                <p className="mt-3 text-xs text-gray-500">Campaigns pause themselves at the pause line.</p>
              </div>
            ),
          },
        ]}
      />

      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-gray-300 bg-white/95 py-3">
        <button type="submit" disabled={busy || !dirty} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save settings
        </button>
        {dirty ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
      </div>
    </form>
  );
};

export default SettingsForm;
