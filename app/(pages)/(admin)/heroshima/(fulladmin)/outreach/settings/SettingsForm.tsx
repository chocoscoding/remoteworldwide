"use client";

import { useState, useTransition, type FC, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { saveMailSettings } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS, type MailSettings, type SettingsInput } from "@/app/lib/mail/types";
import { BTN_PRIMARY, ErrorBox, Field, INPUT, Switch } from "@/app/components/mail/ui";
import { numOrUndef } from "@/app/components/mail/format";

type Form = Required<Omit<SettingsInput, "alarms" | "senders">> & {
  // Alarm limits are typed as percentages here and stored as 0 to 1 rates.
  alarms: { complaintWarn: number; complaintPause: number; bounceWarn: number; bouncePause: number };
  senders: MailSettings["senders"];
};

const toPct = (rate: number) => +(rate * 100).toFixed(3);
const toRate = (percent: number) => +(percent / 100).toFixed(6);

const formOf = (s: MailSettings): Form => {
  const d = DEFAULT_SETTINGS;
  const a = { ...d.alarms, ...(s.alarms ?? {}) };
  return {
    paused: Boolean(s.paused),
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
  };
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** The Mail settings form. Ranges are checked here and again by the backend. */
const SettingsForm: FC<{ settings: MailSettings }> = ({ settings }) => {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formOf(settings));
  const [saved, setSaved] = useState(() => JSON.stringify(formOf(settings)));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(form) !== saved;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAlarm = (key: keyof Form["alarms"], value: number) => setForm((f) => ({ ...f, alarms: { ...f.alarms, [key]: value } }));
  const setSender = (who: "brand" | "founder", key: "name" | "email", value: string) =>
    setForm((f) => ({ ...f, senders: { ...f.senders, [who]: { ...f.senders[who], [key]: value } } }));

  const problem = (): string | null => {
    if (!(form.capPerDay >= 1 && form.capPerDay <= 10)) return "Mails a day: 1 to 10.";
    if (!(form.capPerWeek >= form.capPerDay && form.capPerWeek <= 30)) return "Mails a week: at least the daily cap, at most 30.";
    if (!(form.attributionDays >= 1 && form.attributionDays <= 60)) return "Attribution window: 1 to 60 days.";
    if (!(form.influenceDays >= 0 && form.influenceDays <= 30)) return "Influence window: 0 to 30 days.";
    if (!(form.maxDiscountPercent >= 1 && form.maxDiscountPercent <= 100)) return "Highest discount: 1 to 100%.";
    const a = form.alarms;
    if (!(a.complaintWarn > 0 && a.complaintWarn < a.complaintPause && a.complaintPause <= 100)) return "Complaints: warn must be above 0 and below pause.";
    if (!(a.bounceWarn > 0 && a.bounceWarn < a.bouncePause && a.bouncePause <= 100)) return "Bounces: warn must be above 0 and below pause.";
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.senders.brand.email && !email.test(form.senders.brand.email)) return "The brand sender address isn't valid.";
    if (form.senders.founder.email && !email.test(form.senders.founder.email)) return "The founder sender address isn't valid.";
    if (form.replyDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(form.replyDomain)) return "The reply domain isn't valid (like reply.remoteworldwide.net).";
    return null;
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const issue = problem();
    if (issue) {
      setError(issue);
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
      setSaved(JSON.stringify(next));
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

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Group title="Pause">
        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch checked={form.paused} onChange={(v) => set("paused", v)} label="Pause all marketing" />
          <span className="text-sm">{form.paused ? "All marketing is paused. Product mail still goes out." : "Marketing is on."}</span>
        </div>
      </Group>

      <Group title="Not too much">
        <Field label="Marketing mails a person, a day at most">{num(form.capPerDay, (v) => set("capPerDay", v), { min: 1, max: 10, label: "Per day" })}</Field>
        <Field label="A week at most">{num(form.capPerWeek, (v) => set("capPerWeek", v), { min: 1, max: 30, label: "Per week" })}</Field>
        <Field label="Quiet hours, their local time" hint="Nothing goes out in this window; it waits until it ends.">
          <span className="flex items-center gap-2 text-sm font-normal text-black">
            from
            <select aria-label="Quiet from" className={`${INPUT} w-24`} value={form.quietStart} onChange={(e) => set("quietStart", Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
            to
            <select aria-label="Quiet until" className={`${INPUT} w-24`} value={form.quietEnd} onChange={(e) => set("quietEnd", Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </span>
        </Field>
      </Group>

      <Group title="Credit and discounts">
        <Field label="Attribution window, days after a click" hint="A conversion this soon after a click is credited to the mail.">
          {num(form.attributionDays, (v) => set("attributionDays", v), { min: 1, max: 60, label: "Attribution days" })}
        </Field>
        <Field label="Influence window, days after delivery" hint="Without a click, a conversion this soon after delivery counts as influenced.">
          {num(form.influenceDays, (v) => set("influenceDays", v), { min: 0, max: 30, label: "Influence days" })}
        </Field>
        <Field label="Highest discount accepted, %" hint="Offers and step overrides can't go above it.">
          {num(form.maxDiscountPercent, (v) => set("maxDiscountPercent", v), { min: 1, max: 100, label: "Highest discount" })}
        </Field>
      </Group>

      <Group title="Alarms (campaigns pause themselves at the pause level)">
        <Field label="Complaints, warn at %">{num(form.alarms.complaintWarn, (v) => setAlarm("complaintWarn", v), { min: 0, step: 0.01, label: "Complaints warn" })}</Field>
        <Field label="Complaints, pause at %">{num(form.alarms.complaintPause, (v) => setAlarm("complaintPause", v), { min: 0, step: 0.01, label: "Complaints pause" })}</Field>
        <Field label="Bounces, warn at %">{num(form.alarms.bounceWarn, (v) => setAlarm("bounceWarn", v), { min: 0, step: 0.1, label: "Bounces warn" })}</Field>
        <Field label="Bounces, pause at %">{num(form.alarms.bouncePause, (v) => setAlarm("bouncePause", v), { min: 0, step: 0.1, label: "Bounces pause" })}</Field>
      </Group>

      <Group title="Senders">
        <Field label="Brand name">
          <input className={INPUT} value={form.senders.brand.name} maxLength={80} onChange={(e) => setSender("brand", "name", e.target.value)} />
        </Field>
        <Field label="Brand address (empty: the default)">
          <input type="email" className={INPUT} value={form.senders.brand.email} maxLength={254} onChange={(e) => setSender("brand", "email", e.target.value.trim())} placeholder="hello@news.remoteworldwide.net" />
        </Field>
        <Field label="Founder name">
          <input className={INPUT} value={form.senders.founder.name} maxLength={80} onChange={(e) => setSender("founder", "name", e.target.value)} />
        </Field>
        <Field label="Founder address (empty: the default)">
          <input type="email" className={INPUT} value={form.senders.founder.email} maxLength={254} onChange={(e) => setSender("founder", "email", e.target.value.trim())} placeholder="theo@news.remoteworldwide.net" />
        </Field>
        <Field label="Reply domain (empty: the default)" hint="Replies go to reply+<id>@ this domain and land in the Inbox." className="sm:col-span-2">
          <input className={INPUT} value={form.replyDomain} maxLength={120} onChange={(e) => set("replyDomain", e.target.value.trim())} placeholder="reply.remoteworldwide.net" />
        </Field>
      </Group>

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

const Group: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <fieldset className="rounded-md border border-gray-300 bg-white p-4">
    <legend className="px-1 text-sm font-bold">{title}</legend>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </fieldset>
);

export default SettingsForm;
