"use client";

import { useState, useTransition, type FC, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { createPlaybook, setPlaybookStatus, updatePlaybook } from "@/libs/mail-admin";
import {
  BUILT_IN_EVENTS,
  EVENT_LABELS,
  GOAL_LABELS,
  PLAN_KEYS,
  STEP_FACTS,
  STEP_LABELS,
  STEP_TYPES,
  type BuiltInEvent,
  type Entry,
  type Goal,
  type MailAction,
  type MailAudience,
  type MailOffer,
  type MailPlaybook,
  type MailTemplate,
  type PlaybookInput,
  type PlaybookStatus,
  type PlaybookStepStats,
  type Step,
  type StepType,
  type Trigger,
} from "@/app/lib/mail/types";
import { BTN, BTN_PRIMARY, ChipPicker, ErrorBox, Field, INPUT, INPUT_SM, Notice, Segmented } from "@/app/components/mail/ui";
import { numOrUndef, offerChoiceProblem, slugify } from "@/app/components/mail/format";
import StepCard, { type StepContext } from "./StepCard";

const PLAN_OPTIONS = PLAN_KEYS.map((p) => ({ value: p as string, label: p[0].toUpperCase() + p.slice(1) }));

const inputOf = (p: MailPlaybook | null): PlaybookInput =>
  p
    ? {
        key: p.key,
        name: p.name,
        description: p.description ?? "",
        group: p.group ?? null,
        trigger: p.trigger,
        entry: p.entry ?? {},
        reentry: p.reentry ?? { mode: "never" },
        goal: p.goal ?? { type: "none" },
        holdoutPercent: p.holdoutPercent ?? 0,
        steps: p.steps ?? [],
      }
    : { key: "", name: "", description: "", group: null, trigger: { type: "event", event: "signup" }, entry: {}, reentry: { mode: "never" }, goal: { type: "none" }, holdoutPercent: 0, steps: [] };

const nextId = (steps: Step[]) => {
  const used = new Set(steps.map((s) => s.id));
  let i = steps.length + 1;
  while (used.has(`s${i}`)) i += 1;
  return `s${i}`;
};

const freshStep = (type: StepType, id: string): Step => {
  switch (type) {
    case "send":
      return { id, type, templateId: "" };
    case "wait":
      return { id, type, hours: 24 };
    case "wait_for":
      return { id, type, what: { kind: "click", stepId: "" }, maxHours: 72, onMatch: "next", onTimeout: "next" };
    case "wait_offer":
      return { id, type, offerStepId: "", hoursBeforeExpiry: 12 };
    case "if":
      return { id, type, condition: { fact: "clicked", op: "eq", value: true, stepId: "" }, then: "next", else: "next" };
    case "tag":
      return { id, type, tag: "" };
    default:
      return { id, type: "stop" };
  }
};

/** A step's jumps and step references, with `gone` replaced: jumps go to "next", references empty. */
const forget = (step: Step, gone: string): Step => {
  const jump = (v: string) => (v === gone ? "next" : v);
  switch (step.type) {
    case "wait_for": {
      const what = (step.what.kind === "click" || step.what.kind === "feedback") && step.what.stepId === gone ? { ...step.what, stepId: "" } : step.what;
      return { ...step, what, onMatch: jump(step.onMatch), onTimeout: jump(step.onTimeout) };
    }
    case "wait_offer":
      return step.offerStepId === gone ? { ...step, offerStepId: "" } : step;
    case "if":
      return { ...step, condition: step.condition.stepId === gone ? { ...step.condition, stepId: "" } : step.condition, then: jump(step.then), else: jump(step.else) };
    default:
      return step;
  }
};

type Props = {
  playbook: MailPlaybook | null;
  templates: MailTemplate[];
  offers: MailOffer[];
  actions: MailAction[];
  audiences: MailAudience[];
  maxDiscountPercent: number;
  stats: PlaybookStepStats[];
  /** Charts shown beside the step list (the page renders them from the report). */
  aside?: ReactNode;
};

/** The playbook as a vertical list: trigger, who may enter, re-entry, group, goal, holdout, then the steps. */
const PlaybookEditor: FC<Props> = ({ playbook, templates, offers, actions, audiences, maxDiscountPercent, stats, aside }) => {
  const router = useRouter();
  const [form, setForm] = useState<PlaybookInput>(() => inputOf(playbook));
  const [saved, setSaved] = useState(() => JSON.stringify(inputOf(playbook)));
  const [status, setStatus] = useState<PlaybookStatus>(playbook?.status ?? "draft");
  const [askLive, setAskLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(form) !== saved;
  const liveActions = actions.filter((a) => !a.archived);

  const set = <K extends keyof PlaybookInput>(key: K, value: PlaybookInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setEntry = (entry: Entry) => set("entry", entry);
  const setSteps = (steps: Step[]) => set("steps", steps);
  const ctx: StepContext = { steps: form.steps, templates, offers, actions: liveActions, maxDiscountPercent };
  const statsFor = (id: string) => stats.find((s) => s.stepId === id);

  const problem = (): string | null => {
    if (!form.name.trim()) return "Give the playbook a name.";
    const t = form.trigger;
    if (t.type === "action" && (!t.actionId || !(t.count >= 1) || !(t.withinDays >= 1))) return "The trigger needs an action, a count and a window.";
    if (t.type === "audience" && !t.audienceId) return "Pick the trigger's audience.";
    if (form.goal.type === "action" && !form.goal.actionId) return "Pick the goal's action.";
    if (!(form.holdoutPercent >= 0 && form.holdoutPercent <= 50)) return "Holdout is 0 to 50%.";
    if (form.reentry.mode === "after_days" && !(form.reentry.days >= 1)) return "Set after how many days they may enter again.";
    for (const r of form.entry.requireActions ?? []) if (!r.actionId || !(r.count >= 1)) return "Each required action needs an action and a count.";
    const ids = new Set(form.steps.map((s) => s.id));
    const jumpOk = (v: string) => v === "next" || ids.has(v);
    for (const [i, s] of form.steps.entries()) {
      const at = `Step ${i + 1}`;
      if (s.type === "send") {
        if (!s.templateId) return `${at}: pick a template.`;
        const issue = offerChoiceProblem(s.offer, offers, maxDiscountPercent);
        if (issue) return `${at}: ${issue}`;
      }
      if (s.type === "wait" && !(s.hours >= 1)) return `${at}: wait at least 1 hour.`;
      if (s.type === "wait_for") {
        const w = s.what;
        if ((w.kind === "click" || w.kind === "feedback") && !ids.has(w.stepId)) return `${at}: pick the step to wait on.`;
        if (w.kind === "action" && !w.actionId) return `${at}: pick the action to wait for.`;
        if (!(s.maxHours >= 1)) return `${at}: wait at least 1 hour.`;
        if (!jumpOk(s.onMatch) || !jumpOk(s.onTimeout)) return `${at}: a jump points at a removed step.`;
      }
      if (s.type === "wait_offer") {
        const target = form.steps.find((x) => x.id === s.offerStepId);
        if (!target || target.type !== "send" || !target.offer) return `${at}: pick a send step that carries an offer.`;
        const offer = offers.find((o) => o.id === target.offer?.offerId);
        const valid = target.offer.validHoursOverride ?? offer?.validHours ?? 0;
        if (!(s.hoursBeforeExpiry >= 1) || (valid && s.hoursBeforeExpiry >= valid)) return `${at}: the reminder must come before the code expires (valid ${valid} h).`;
      }
      if (s.type === "if") {
        const c = s.condition;
        if (STEP_FACTS.includes(c.fact) && !ids.has(c.stepId ?? "")) return `${at}: pick the step the condition is about.`;
        if (c.fact === "actionCount" && !c.actionId) return `${at}: pick the action to count.`;
        if (c.op === "in" && (!Array.isArray(c.value) || !c.value.length)) return `${at}: pick at least one value.`;
        if (!jumpOk(s.then) || !jumpOk(s.else)) return `${at}: a jump points at a removed step.`;
      }
      if (s.type === "tag" && !s.tag.trim()) return `${at}: write the tag.`;
    }
    return null;
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const issue = problem();
    if (issue) {
      setError(issue);
      return;
    }
    const input: PlaybookInput = {
      ...form,
      name: form.name.trim(),
      key: form.key?.trim() || slugify(form.name),
      group: form.group?.trim() ? form.group.trim() : null,
    };
    start(async () => {
      setError(null);
      setNote(null);
      const res = playbook ? await updatePlaybook(playbook.id, input) : await createPlaybook(input);
      if (res.error || !res.data) {
        setError(res.error ?? "Not saved.");
        return;
      }
      setForm(input);
      setSaved(JSON.stringify(input));
      setNote(res.data.version && playbook && res.data.version !== playbook.version ? `Saved as version ${res.data.version}.` : "Saved.");
      if (!playbook) router.replace(`/heroshima/outreach/playbooks/${res.data.id}`);
      else router.refresh();
    });
  };

  const changeStatus = (next: PlaybookStatus) => {
    if (!playbook || next === status) return;
    if (dirty) {
      setError("Save your changes first.");
      return;
    }
    if (next === "live" && !askLive) {
      setAskLive(true);
      return;
    }
    start(async () => {
      setError(null);
      setAskLive(false);
      const res = await setPlaybookStatus(playbook.id, next);
      if (res.error) {
        setError(res.error);
        return;
      }
      setStatus(res.data?.status ?? next);
      router.refresh();
    });
  };

  const moveStep = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= form.steps.length) return;
    const next = [...form.steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };
  const removeStep = (i: number) => {
    const gone = form.steps[i].id;
    setSteps(form.steps.filter((_, j) => j !== i).map((s) => forget(s, gone)));
  };

  const t = form.trigger;
  const setTrigger = (trigger: Trigger) => set("trigger", trigger);
  const g = form.goal;

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {playbook ? (
        <section className="flex flex-wrap items-center gap-3 rounded-md border border-gray-300 bg-white p-4">
          <span className="text-sm font-bold">Status</span>
          <Segmented
            label="Status"
            value={status}
            onChange={changeStatus}
            disabled={busy}
            options={[
              { value: "draft", label: "Draft" },
              { value: "live", label: "Live" },
              { value: "paused", label: "Paused" },
            ]}
          />
          <span className="text-xs text-gray-500">Version {playbook.version}</span>
          {askLive ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm">People who match from now on enter and get mail.</span>
              <button type="button" onClick={() => changeStatus("live")} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-xs font-bold text-[#e1f073] br-bold-press br-lime">
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Yes, go live
              </button>
              <button type="button" onClick={() => setAskLive(false)} className="px-2 text-xs font-semibold text-gray-500">
                Cancel
              </button>
            </span>
          ) : null}
        </section>
      ) : null}

      <Section title="Playbook">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <input className={INPUT} value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="Eyeing plans" />
          </Field>
          <Field label="Key (empty: from the name)">
            <input className={`${INPUT} font-mono`} value={form.key ?? ""} maxLength={60} disabled={Boolean(playbook)} onChange={(e) => set("key", e.target.value)} />
          </Field>
          <Field label="What it is for" className="md:col-span-2">
            <input className={INPUT} value={form.description} maxLength={300} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="When">
        <Segmented
          label="Trigger"
          value={t.type}
          onChange={(type) =>
            setTrigger(type === "action" ? { type, actionId: "", count: 2, withinDays: 3 } : type === "event" ? { type, event: "signup" } : { type, audienceId: "" })
          }
          options={[
            { value: "action", label: "They do something" },
            { value: "event", label: "Something happens" },
            { value: "audience", label: "They join an audience" },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          {t.type === "action" ? (
            <>
              <select aria-label="Action" className={INPUT_SM} value={t.actionId} onChange={(e) => setTrigger({ ...t, actionId: e.target.value })}>
                <option value="">Pick an action</option>
                {liveActions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input type="number" min={1} aria-label="Times" className={`${INPUT_SM} w-16 tabular-nums`} value={t.count} onChange={(e) => setTrigger({ ...t, count: numOrUndef(e.target.value) ?? 0 })} />
              times within
              <input type="number" min={1} aria-label="Days" className={`${INPUT_SM} w-16 tabular-nums`} value={t.withinDays} onChange={(e) => setTrigger({ ...t, withinDays: numOrUndef(e.target.value) ?? 0 })} />
              days
            </>
          ) : t.type === "event" ? (
            <select aria-label="Event" className={INPUT_SM} value={t.event} onChange={(e) => setTrigger({ ...t, event: e.target.value as BuiltInEvent })}>
              {BUILT_IN_EVENTS.map((e) => (
                <option key={e} value={e}>
                  {EVENT_LABELS[e]}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select aria-label="Audience" className={INPUT_SM} value={t.audienceId} onChange={(e) => setTrigger({ ...t, audienceId: e.target.value })}>
                <option value="">Pick an audience</option>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">Checked once a day.</span>
            </>
          )}
        </div>
      </Section>

      <Section title="Only if">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Account at least, days old">
            <input
              type="number"
              min={0}
              className={`${INPUT} w-28 tabular-nums`}
              value={form.entry.minAccountAgeDays ?? ""}
              onChange={(e) => setEntry({ ...form.entry, minAccountAgeDays: numOrUndef(e.target.value) })}
            />
          </Field>
          <Field label="No offer in the last, days">
            <input
              type="number"
              min={0}
              className={`${INPUT} w-28 tabular-nums`}
              value={form.entry.noOfferWithinDays ?? ""}
              onChange={(e) => setEntry({ ...form.entry, noOfferWithinDays: numOrUndef(e.target.value) })}
            />
          </Field>
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-600">Plan is (none = any)</p>
            <ChipPicker label="Plan is" values={form.entry.plans ?? []} options={PLAN_OPTIONS} onChange={(v) => setEntry({ ...form.entry, plans: v })} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-600">Plan is not</p>
            <ChipPicker label="Plan is not" values={form.entry.notPlans ?? []} options={PLAN_OPTIONS} onChange={(v) => setEntry({ ...form.entry, notPlans: v })} />
          </div>
          <div className="md:col-span-2">
            <p className="mb-1 text-xs font-semibold text-gray-600">And they have done</p>
            <ul className="flex flex-col gap-1.5">
              {(form.entry.requireActions ?? []).map((r, i) => {
                const list = form.entry.requireActions ?? [];
                const put = (next: typeof r) => setEntry({ ...form.entry, requireActions: list.map((x, j) => (j === i ? next : x)) });
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5 text-sm">
                    <select aria-label="Action" className={INPUT_SM} value={r.actionId} onChange={(e) => put({ ...r, actionId: e.target.value })}>
                      <option value="">Pick an action</option>
                      {liveActions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    at least
                    <input type="number" min={1} aria-label="Times" className={`${INPUT_SM} w-16 tabular-nums`} value={r.count} onChange={(e) => put({ ...r, count: numOrUndef(e.target.value) ?? 0 })} />
                    times, in the last
                    <input
                      type="number"
                      min={1}
                      aria-label="Days"
                      placeholder="any"
                      className={`${INPUT_SM} w-16 tabular-nums`}
                      value={r.withinDays ?? ""}
                      onChange={(e) => put({ ...r, withinDays: numOrUndef(e.target.value) })}
                    />
                    days
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => setEntry({ ...form.entry, requireActions: list.filter((_, j) => j !== i) })}
                      className="rounded border border-gray-300 p-1 hover:border-black">
                      <Trash2 className="h-3.5 w-3.5 text-[#b23c26]" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className={`${BTN} mt-2`}
              onClick={() => setEntry({ ...form.entry, requireActions: [...(form.entry.requireActions ?? []), { actionId: "", count: 1 }] })}>
              + Required action
            </button>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Again?">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Segmented
              label="Re-entry"
              value={form.reentry.mode}
              onChange={(mode) => set("reentry", mode === "never" ? { mode } : { mode, days: 90 })}
              options={[
                { value: "never", label: "Once ever" },
                { value: "after_days", label: "Again after" },
              ]}
            />
            {form.reentry.mode === "after_days" ? (
              <>
                <input
                  type="number"
                  min={1}
                  aria-label="Days"
                  className={`${INPUT_SM} w-20 tabular-nums`}
                  value={form.reentry.days}
                  onChange={(e) => set("reentry", { mode: "after_days", days: numOrUndef(e.target.value) ?? 0 })}
                />
                days
              </>
            ) : null}
          </div>
        </Section>
        <Section title="Group">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${INPUT} max-w-[200px]`} list="mail-playbook-groups" value={form.group ?? ""} maxLength={40} onChange={(e) => set("group", e.target.value || null)} placeholder="None" />
            <datalist id="mail-playbook-groups">
              <option value="billing" />
              <option value="onboarding" />
            </datalist>
            <span className="text-xs text-gray-500">One playbook of a group at a time per person.</span>
          </div>
        </Section>
        <Section title="Goal">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <select
              aria-label="Goal"
              className={INPUT_SM}
              value={g.type}
              onChange={(e) => {
                const type = e.target.value as Goal["type"];
                set("goal", type === "event" ? { type, event: "subscription_started" } : type === "action" ? { type, actionId: "" } : ({ type } as Goal));
              }}>
              {(Object.keys(GOAL_LABELS) as Goal["type"][]).map((k) => (
                <option key={k} value={k}>
                  {GOAL_LABELS[k]}
                </option>
              ))}
            </select>
            {g.type === "event" ? (
              <select aria-label="Goal event" className={INPUT_SM} value={g.event} onChange={(e) => set("goal", { type: "event", event: e.target.value as BuiltInEvent })}>
                {BUILT_IN_EVENTS.map((e) => (
                  <option key={e} value={e}>
                    {EVENT_LABELS[e]}
                  </option>
                ))}
              </select>
            ) : g.type === "action" ? (
              <select aria-label="Goal action" className={INPUT_SM} value={g.actionId} onChange={(e) => set("goal", { type: "action", actionId: e.target.value })}>
                <option value="">Pick an action</option>
                {liveActions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="text-xs text-gray-500">Checked before every step. Met = they leave.</span>
          </div>
        </Section>
        <Section title="Holdout">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <input
              type="number"
              min={0}
              max={50}
              aria-label="Holdout percent"
              className={`${INPUT_SM} w-16 tabular-nums`}
              value={form.holdoutPercent}
              onChange={(e) => set("holdoutPercent", numOrUndef(e.target.value) ?? 0)}
            />
            % get no mail and are measured. 10% for offer playbooks shows the real lift.
          </div>
        </Section>
      </div>

      <div className={aside ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]" : undefined}>
      <Section title="Steps">
        {form.steps.length ? (
          <ol className="flex flex-col gap-2">
            {form.steps.map((s, i) => (
              <StepCard
                key={s.id}
                step={s}
                index={i}
                ctx={ctx}
                stats={statsFor(s.id)}
                playbookId={playbook?.id ?? null}
                onChange={(step) => setSteps(form.steps.map((x, j) => (j === i ? step : x)))}
                onMove={(by) => moveStep(i, by)}
                onRemove={() => removeStep(i)}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">No steps yet.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">Add</span>
          {STEP_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSteps([...form.steps, freshStep(type, nextId(form.steps))])}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-black">
              + {STEP_LABELS[type]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Steps run top to bottom. Waits, branches and jumps move people along; they leave after the last step or on the goal.</p>
      </Section>
      {aside ? <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">{aside}</aside> : null}
      </div>

      {playbook && status !== "draft" && dirty ? (
        <Notice tone="warn">Saving makes version {playbook.version + 1}. People already in finish the version they started.</Notice>
      ) : null}
      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-gray-300 bg-white/95 py-3">
        <button type="submit" disabled={busy || (!dirty && Boolean(playbook))} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {playbook ? "Save" : "Create playbook"}
        </button>
        {dirty ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
      </div>
    </form>
  );
};

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section className="rounded-md border border-gray-300 bg-white p-4">
    <h2 className="mb-3 text-sm font-bold">{title}</h2>
    {children}
  </section>
);

export default PlaybookEditor;
