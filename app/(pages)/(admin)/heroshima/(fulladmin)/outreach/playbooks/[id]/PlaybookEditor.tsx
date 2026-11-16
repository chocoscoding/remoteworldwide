"use client";

import { Fragment, useMemo, useRef, useState, useTransition, type FC, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, X, Zap } from "lucide-react";
import { createPlaybook, setPlaybookStatus, updatePlaybook } from "@/libs/mail-admin";
import {
  STEP_FACTS,
  STEP_LABELS,
  STEP_TYPES,
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
import { BTN, BTN_LINK, BTN_PRIMARY, ErrorBox, INPUT, Notice, StatusChip } from "@/app/components/mail/ui";
import { offerChoiceProblem, slugify } from "@/app/components/mail/format";
import TriggersDrawer from "@/app/components/mail/playbook/TriggersDrawer";
import { rulesSentence, triggerSentence } from "@/app/components/mail/playbook/summary";
import { cn } from "@/lib/utils";
import RulesDrawer from "./RulesDrawer";
import StepCard, { StepInspector, type StepContext } from "./StepCard";
import TriggerFields from "./TriggerFields";

const STATUS_LABEL: Record<PlaybookStatus, string> = { draft: "Draft", live: "Live", paused: "Paused" };

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

/** What is selected in the flow: the trigger card, a step (by id) or nothing. */
type Selection = { kind: "trigger" } | { kind: "step"; id: string } | null;
/** What a failed check points at, so the screen can show it. */
type Problem = { text: string; at?: "name" | "trigger" | "rules" | { step: string } };

type Props = {
  playbook: MailPlaybook | null;
  templates: MailTemplate[];
  offers: MailOffer[];
  actions: MailAction[];
  audiences: MailAudience[];
  maxDiscountPercent: number;
  stats: PlaybookStepStats[];
  /** The one line of numbers (and the folded report charts) the page renders from the report. */
  numbers?: ReactNode;
};

/**
 * The playbook editor: a header (rename, status and its actions), the rules as one sentence with
 * a drawer to edit them, then the flow (the trigger, then each step as a compact card). Pressing a
 * card opens only its fields in the inspector on the right. One Save keeps everything.
 */
const PlaybookEditor: FC<Props> = ({ playbook, templates, offers, actions, audiences, maxDiscountPercent, stats, numbers }) => {
  const router = useRouter();
  const [form, setForm] = useState<PlaybookInput>(() => inputOf(playbook));
  const [saved, setSaved] = useState(() => JSON.stringify(inputOf(playbook)));
  const [status, setStatus] = useState<PlaybookStatus>(playbook?.status ?? "draft");
  const [askLive, setAskLive] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [selected, setSelected] = useState<Selection>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newTriggerOpen, setNewTriggerOpen] = useState(false);
  const [renaming, setRenaming] = useState(!playbook);
  // A trigger made here, until the refreshed page lists it.
  const [madeHere, setMadeHere] = useState<MailAction[]>([]);
  const inspectorRef = useRef<HTMLElement>(null);
  const dirty = JSON.stringify(form) !== saved;

  const allActions = useMemo(() => [...actions, ...madeHere.filter((m) => !actions.some((a) => a.id === m.id))], [actions, madeHere]);
  const liveActions = useMemo(() => allActions.filter((a) => !a.archived), [allActions]);

  const set = <K extends keyof PlaybookInput>(key: K, value: PlaybookInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const update = (patch: Partial<PlaybookInput>) => setForm((f) => ({ ...f, ...patch }));
  const setSteps = (steps: Step[]) => set("steps", steps);
  const ctx: StepContext = { steps: form.steps, templates, offers, actions: liveActions, maxDiscountPercent };
  const statsFor = (id: string) => stats.find((s) => s.stepId === id);

  /** Select a card; on a narrow screen the inspector sits under the flow, so bring it into view. */
  const select = (next: Selection) => {
    setSelected(next);
    setAdding(null);
    if (next && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const problem = (): Problem | null => {
    if (!form.name.trim()) return { text: "Give the playbook a name.", at: "name" };
    const t = form.trigger;
    if (t.type === "action" && (!t.actionId || !(t.count >= 1) || !(t.withinDays >= 1))) return { text: "The trigger needs an action, a count and a window.", at: "trigger" };
    if (t.type === "audience" && !t.audienceId) return { text: "Pick the trigger's audience.", at: "trigger" };
    if (form.goal.type === "action" && !form.goal.actionId) return { text: "Pick the goal's action.", at: "rules" };
    if (!(form.holdoutPercent >= 0 && form.holdoutPercent <= 50)) return { text: "Holdout is 0 to 50%.", at: "rules" };
    if (form.reentry.mode === "after_days" && !(form.reentry.days >= 1)) return { text: "Set after how many days they may enter again.", at: "rules" };
    for (const r of form.entry.requireActions ?? []) if (!r.actionId || !(r.count >= 1)) return { text: "Each required action needs an action and a count.", at: "rules" };
    const ids = new Set(form.steps.map((s) => s.id));
    const jumpOk = (v: string) => v === "next" || ids.has(v);
    for (const [i, s] of form.steps.entries()) {
      const at = `Step ${i + 1}`;
      const here = { step: s.id };
      if (s.type === "send") {
        if (!s.templateId) return { text: `${at}: pick a template.`, at: here };
        const issue = offerChoiceProblem(s.offer, offers, maxDiscountPercent);
        if (issue) return { text: `${at}: ${issue}`, at: here };
      }
      if (s.type === "wait" && !(s.hours >= 1)) return { text: `${at}: wait at least 1 hour.`, at: here };
      if (s.type === "wait_for") {
        const w = s.what;
        if ((w.kind === "click" || w.kind === "feedback") && !ids.has(w.stepId)) return { text: `${at}: pick the step to wait on.`, at: here };
        if (w.kind === "action" && !w.actionId) return { text: `${at}: pick the action to wait for.`, at: here };
        if (!(s.maxHours >= 1)) return { text: `${at}: wait at least 1 hour.`, at: here };
        if (!jumpOk(s.onMatch) || !jumpOk(s.onTimeout)) return { text: `${at}: a jump points at a removed step.`, at: here };
      }
      if (s.type === "wait_offer") {
        const target = form.steps.find((x) => x.id === s.offerStepId);
        if (!target || target.type !== "send" || !target.offer) return { text: `${at}: pick a send step that carries an offer.`, at: here };
        const offer = offers.find((o) => o.id === target.offer?.offerId);
        const valid = target.offer.validHoursOverride ?? offer?.validHours ?? 0;
        if (!(s.hoursBeforeExpiry >= 1) || (valid && s.hoursBeforeExpiry >= valid)) return { text: `${at}: the reminder must come before the code expires (valid ${valid} h).`, at: here };
      }
      if (s.type === "if") {
        const c = s.condition;
        if (STEP_FACTS.includes(c.fact) && !ids.has(c.stepId ?? "")) return { text: `${at}: pick the step the condition is about.`, at: here };
        if (c.fact === "actionCount" && !c.actionId) return { text: `${at}: pick the action to count.`, at: here };
        if (c.op === "in" && (!Array.isArray(c.value) || !c.value.length)) return { text: `${at}: pick at least one value.`, at: here };
        if (!jumpOk(s.then) || !jumpOk(s.else)) return { text: `${at}: a jump points at a removed step.`, at: here };
      }
      if (s.type === "tag" && !s.tag.trim()) return { text: `${at}: write the tag.`, at: here };
    }
    return null;
  };

  /** Show where a failed check points: the name field, the trigger or the step in the inspector. */
  const reveal = (issue: Problem) => {
    if (issue.at === "name") setRenaming(true);
    else if (issue.at === "trigger") select({ kind: "trigger" });
    else if (issue.at && typeof issue.at === "object") select({ kind: "step", id: issue.at.step });
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const issue = problem();
    if (issue) {
      setError(issue);
      reveal(issue);
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
        setError({ text: res.error ?? "Not saved." });
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
      setError({ text: "Save your changes first." });
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
        setError({ text: res.error });
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
    setSelected(null);
  };
  const insertStep = (at: number, type: StepType) => {
    const step = freshStep(type, nextId(form.steps));
    const next = [...form.steps];
    next.splice(at, 0, step);
    setSteps(next);
    select({ kind: "step", id: step.id });
  };

  const setTrigger = (trigger: Trigger) => set("trigger", trigger);
  const selectedIndex = selected?.kind === "step" ? form.steps.findIndex((s) => s.id === selected.id) : -1;
  const selectedStep = selectedIndex >= 0 ? form.steps[selectedIndex] : null;
  const renamed = playbook && form.name.trim() !== playbook.name;

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter would submit the whole form; here it only closes the name field.
    if (e.key === "Enter") {
      e.preventDefault();
      if (playbook && form.name.trim()) setRenaming(false);
    }
    if (e.key === "Escape" && playbook) {
      e.preventDefault();
      set("name", playbook.name);
      setRenaming(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {/* Header: name, status and its actions. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {renaming ? (
          <span className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="playbook-name">
              Name
            </label>
            <input
              id="playbook-name"
              className={`${INPUT} w-72 max-w-full font-semibold`}
              value={form.name}
              maxLength={120}
              autoFocus={Boolean(playbook)}
              onKeyDown={onNameKey}
              onChange={(e) => set("name", e.target.value)}
              placeholder={playbook ? "Name" : "Name this playbook"}
            />
            {playbook ? (
              <button type="button" className={BTN} onClick={() => setRenaming(false)} disabled={!form.name.trim()}>
                Done
              </button>
            ) : null}
          </span>
        ) : (
          <button type="button" onClick={() => setRenaming(true)} className={`${BTN_LINK} inline-flex items-center gap-1`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Rename
          </button>
        )}
        {!renaming && renamed ? <span className="text-xs text-gray-500">New name: &quot;{form.name.trim() || "Untitled"}&quot;, not saved yet</span> : null}

        {playbook ? (
          <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <StatusChip status={status} label={STATUS_LABEL[status] ?? status} />
            <span className="text-xs text-gray-500">Version {playbook.version}</span>
            {askLive ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm">People who match from now on enter and get mail.</span>
                <button
                  type="button"
                  onClick={() => changeStatus("live")}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-xs font-bold text-[#e1f073] br-bold-press br-lime">
                  {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Yes, go live
                </button>
                <button type="button" onClick={() => setAskLive(false)} className="px-2 text-xs font-semibold text-gray-500">
                  Cancel
                </button>
              </span>
            ) : (
              <>
                {status !== "live" ? (
                  <button type="button" className={BTN} onClick={() => changeStatus("live")} disabled={busy}>
                    {status === "paused" ? "Resume" : "Go live"}
                  </button>
                ) : (
                  <button type="button" className={BTN} onClick={() => changeStatus("paused")} disabled={busy}>
                    Pause
                  </button>
                )}
                {status !== "draft" ? (
                  <button type="button" className={BTN_LINK} onClick={() => changeStatus("draft")} disabled={busy}>
                    Back to draft
                  </button>
                ) : null}
              </>
            )}
          </span>
        ) : null}
      </div>

      {/* The rules in one sentence. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-gray-300 bg-white px-4 py-2.5">
        <span className="text-xs font-semibold text-gray-500">Rules</span>
        <span className="min-w-0 flex-1 text-sm">{rulesSentence(form, liveActions)}</span>
        <button type="button" className={BTN} onClick={() => setRulesOpen(true)} aria-haspopup="dialog">
          Edit rules
        </button>
      </div>

      {numbers}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* The flow: trigger, then the steps top to bottom. */}
        <section aria-label="Steps" className="min-w-0 rounded-md border border-gray-300 bg-white p-4">
          <ol className="flex flex-col">
            <li>
              <button
                type="button"
                onClick={() => select({ kind: "trigger" })}
                aria-pressed={selected?.kind === "trigger"}
                className={cn(
                  "block w-full rounded-md bg-white px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                  selected?.kind === "trigger" ? "br-shadow" : "br-plain-press",
                )}>
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-black bg-[#e1f073]">
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">When</span>
                    <span className="block truncate text-sm">{triggerSentence(form.trigger, liveActions, audiences)}</span>
                  </span>
                </span>
              </button>
            </li>
            {form.steps.map((s, i) => (
              <Fragment key={s.id}>
                <Connector open={adding === i} onOpen={() => setAdding(adding === i ? null : i)} onPick={(type) => insertStep(i, type)} onClose={() => setAdding(null)} label={`Add a step before step ${i + 1}`} />
                <li>
                  <StepCard step={s} index={i} ctx={ctx} stats={statsFor(s.id)} selected={selected?.kind === "step" && selected.id === s.id} onSelect={() => select({ kind: "step", id: s.id })} />
                </li>
              </Fragment>
            ))}
            <li aria-hidden className="ml-[23px] h-4 border-l border-gray-300" />
            <li>
              {adding === form.steps.length ? (
                <StepTypeMenu onPick={(type) => insertStep(form.steps.length, type)} onClose={() => setAdding(null)} />
              ) : (
                <button type="button" className={`${BTN} gap-1.5`} onClick={() => setAdding(form.steps.length)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add step
                </button>
              )}
            </li>
          </ol>
          {!form.steps.length ? <p className="mt-3 text-xs text-gray-500">No steps yet. Add the first: usually a wait, then a send.</p> : null}
        </section>

        {/* The inspector: only what the selected card needs. */}
        <aside ref={inspectorRef} aria-label="Inspector" className="min-w-0 scroll-mt-4 rounded-md border border-gray-300 bg-white p-4 lg:sticky lg:top-4">
          {selected?.kind === "trigger" ? (
            <TriggerFields trigger={form.trigger} onChange={setTrigger} actions={liveActions} audiences={audiences} onNewTrigger={() => setNewTriggerOpen(true)} />
          ) : selectedStep ? (
            <StepInspector
              key={selectedStep.id}
              step={selectedStep}
              index={selectedIndex}
              ctx={ctx}
              stats={statsFor(selectedStep.id)}
              playbookId={playbook?.id ?? null}
              onChange={(step) => setSteps(form.steps.map((x, j) => (j === selectedIndex ? step : x)))}
              onMove={(by) => moveStep(selectedIndex, by)}
              onRemove={() => removeStep(selectedIndex)}
            />
          ) : (
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              <p className="font-semibold text-black">Pick a card to change it.</p>
              <p>The trigger decides who enters. Steps run top to bottom; waits, branches and jumps move people along, and they leave after the last step or when the goal is met.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-gray-300 bg-white/95 py-3">
        {playbook && status !== "draft" && dirty ? <Notice tone="warn">Saving makes version {playbook.version + 1}. People already in finish the version they started.</Notice> : null}
        {error ? (
          <ErrorBox className="flex flex-wrap items-center gap-2">
            <span>{error.text}</span>
            {error.at === "rules" ? (
              <button type="button" className="font-semibold underline" onClick={() => setRulesOpen(true)}>
                Edit rules
              </button>
            ) : null}
          </ErrorBox>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy || (!dirty && Boolean(playbook))} className={BTN_PRIMARY}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {playbook ? "Save" : "Create playbook"}
          </button>
          {dirty ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
        </div>
      </div>

      <RulesDrawer open={rulesOpen} onOpenChange={setRulesOpen} form={form} update={update} actions={liveActions} keyLocked={Boolean(playbook)} />
      <TriggersDrawer
        open={newTriggerOpen}
        onOpenChange={setNewTriggerOpen}
        actions={allActions}
        start="new"
        onSaved={(action) => {
          if (!action.id) return;
          setMadeHere((list) => [...list.filter((a) => a.id !== action.id), action]);
          setForm((f) => (f.trigger.type === "action" ? { ...f, trigger: { ...f.trigger, actionId: action.id } } : f));
        }}
      />
    </form>
  );
};

/** The line between two cards, with a small "+" that opens the step types to insert there. */
const Connector: FC<{ open: boolean; onOpen: () => void; onPick: (type: StepType) => void; onClose: () => void; label: string }> = ({ open, onOpen, onPick, onClose, label }) => (
  <li className="relative ml-[23px] border-l border-gray-300 py-1.5 pl-5">
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      aria-expanded={open}
      className={cn(
        "absolute left-0 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white",
        open ? "border-black text-black" : "border-gray-300 text-gray-400 hover:border-black hover:text-black",
      )}>
      {open ? <X className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
    </button>
    {open ? <StepTypeMenu onPick={onPick} onClose={onClose} compact /> : <span className="block h-3" />}
  </li>
);

/** The step types as small buttons; Escape closes. */
const StepTypeMenu: FC<{ onPick: (type: StepType) => void; onClose: () => void; compact?: boolean }> = ({ onPick, onClose, compact }) => (
  <div
    role="group"
    aria-label="Step type"
    className={cn("flex flex-wrap items-center gap-1.5", compact ? "py-1" : "")}
    onKeyDown={(e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }}>
    {STEP_TYPES.map((type, i) => (
      <button
        key={type}
        type="button"
        autoFocus={i === 0}
        onClick={() => onPick(type)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-black hover:text-black">
        + {STEP_LABELS[type]}
      </button>
    ))}
    {compact ? null : (
      <button type="button" onClick={onClose} className={BTN_LINK}>
        Cancel
      </button>
    )}
  </div>
);

export default PlaybookEditor;
