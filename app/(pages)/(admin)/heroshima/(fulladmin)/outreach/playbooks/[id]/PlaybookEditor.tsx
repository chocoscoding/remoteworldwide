"use client";

import { Fragment, useCallback, useMemo, useRef, useState, useTransition, type FC, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MoreHorizontal, Plus, X, Zap } from "lucide-react";
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
import { BTN, BTN_LINK, BTN_PRIMARY, ErrorBox, Notice, StatusChip } from "@/app/components/mail/ui";
import { offerChoiceProblem, slugify } from "@/app/components/mail/format";
import { Popover } from "@/app/components/mail/audience/Popover";
import TriggersDrawer from "@/app/components/mail/playbook/TriggersDrawer";
import { rulesSentence, triggerSentence } from "@/app/components/mail/playbook/summary";
import { cn } from "@/lib/utils";
import RulesDrawer from "./RulesDrawer";
import StepCard, { StepInspector, type StepContext } from "./StepCard";
import TriggerFields from "./TriggerFields";

const STATUS_LABEL: Record<PlaybookStatus, string> = { draft: "Draft", live: "Live", paused: "Paused" };

/** The rules line starts a line on its own now, so it opens with a capital ("Not Pro or Ultra · once"). */
const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

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
  /** The quiet line of numbers (and the folded report charts) the page renders once people have entered. */
  numbers?: ReactNode;
};

/**
 * The playbook editor: the name as the page title (edited in place) with the status and its one
 * action, the rules as one quiet line that opens their drawer, then the flow (the trigger, then
 * each step as a compact card). Pressing a card opens only its fields in the inspector on the
 * right. One Save, in the sticky bar, keeps everything.
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
  // A new playbook starts on its trigger: that is the first thing to set.
  const [selected, setSelected] = useState<Selection>(() => (playbook ? null : { kind: "trigger" }));
  const [adding, setAdding] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newTriggerOpen, setNewTriggerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  // A trigger made here, until the refreshed page lists it.
  const [madeHere, setMadeHere] = useState<MailAction[]>([]);
  const inspectorRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
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

  /** Show where a failed check points: the name (the title), the trigger or the step in the inspector. */
  const reveal = (issue: Problem) => {
    if (issue.at === "name") nameRef.current?.focus();
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

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter would submit the whole form; here it only leaves the title. Escape puts the saved name back.
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape" && playbook) {
      e.preventDefault();
      set("name", playbook.name);
      e.currentTarget.blur();
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {/* The name is the page's title, edited in place; the status and its one action sit on the right. */}
      <header className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="sr-only">{form.name.trim() || "New playbook"}</h1>
          <input
            ref={nameRef}
            aria-label="Playbook name"
            value={form.name}
            maxLength={120}
            onKeyDown={onNameKey}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Untitled playbook"
            className="-mx-1.5 w-full min-w-0 max-w-2xl flex-1 basis-64 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-bold placeholder:text-gray-400 hover:border-gray-300 focus:border-black focus:outline-none"
          />

          {playbook ? (
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <span title={`Version ${playbook.version}`}>
                <StatusChip status={status} label={STATUS_LABEL[status] ?? status} />
              </span>
              {askLive ? (
                <>
                  <span className="text-sm">People who match from now on enter and get mail.</span>
                  <button type="button" onClick={() => setAskLive(false)} className="px-2 text-xs font-semibold text-gray-500">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => changeStatus("live")}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-xs font-bold text-[#e1f073] br-bold-press br-lime">
                    {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Yes, go live
                  </button>
                </>
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
                    <Popover
                      open={moreOpen}
                      onClose={closeMore}
                      label="More"
                      align="right"
                      panelClassName="min-w-0 p-1"
                      trigger={
                        <button
                          type="button"
                          aria-label="More"
                          title="More"
                          aria-expanded={moreOpen}
                          onClick={() => setMoreOpen((o) => !o)}
                          className={cn("flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-black", moreOpen && "bg-gray-100 text-black")}>
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      }>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setMoreOpen(false);
                          changeStatus("draft");
                        }}
                        className="block w-full whitespace-nowrap rounded px-2.5 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-black disabled:opacity-60">
                        Back to draft
                      </button>
                    </Popover>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* The rules in one quiet sentence; pressing it opens the drawer. */}
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          aria-haspopup="dialog"
          className="group -mx-1.5 self-start rounded-md px-1.5 py-0.5 text-left text-sm text-gray-500 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
          {upperFirst(rulesSentence(form, liveActions))}
          <span className="ml-2 text-xs font-semibold text-gray-600 underline-offset-2 group-hover:text-black group-hover:underline">Edit rules</span>
        </button>

        {numbers}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* The flow: trigger, then the steps top to bottom. */}
        <section aria-label="Steps" className="min-w-0 rounded-md border border-gray-200 bg-white p-4">
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
            <li aria-hidden className="ml-[23px] h-3 border-l border-gray-300" />
            <li>
              {adding === form.steps.length ? (
                <StepTypeMenu onPick={(type) => insertStep(form.steps.length, type)} onClose={() => setAdding(null)} />
              ) : (
                <button type="button" className={`${BTN} gap-1.5`} onClick={() => setAdding(form.steps.length)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> {form.steps.length ? "Add step" : "Add a step"}
                </button>
              )}
            </li>
          </ol>
        </section>

        {/* The inspector: only what the selected card needs; with nothing picked, one quiet line. */}
        {selected?.kind === "trigger" || selectedStep ? (
          <aside ref={inspectorRef} aria-label="Inspector" className="min-w-0 scroll-mt-4 rounded-md border border-gray-200 bg-white p-4 lg:sticky lg:top-4">
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
            ) : null}
          </aside>
        ) : (
          <aside ref={inspectorRef} aria-label="Inspector" className="hidden pt-3 text-sm text-gray-500 lg:sticky lg:top-4 lg:block">
            Pick a card to edit it.
          </aside>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-gray-300 bg-white/95 py-3 backdrop-blur">
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
        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
          <button type="submit" disabled={busy || (!dirty && Boolean(playbook))} className={BTN_PRIMARY}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {playbook ? "Save" : "Create playbook"}
          </button>
        </div>
      </div>

      <RulesDrawer open={rulesOpen} onOpenChange={setRulesOpen} form={form} update={update} actions={liveActions} keyLocked={Boolean(playbook)} version={playbook?.version} />
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

/** The line between two cards. A small "+" shows on hover or focus (always on touch screens) and opens the step types to insert there. */
const Connector: FC<{ open: boolean; onOpen: () => void; onPick: (type: StepType) => void; onClose: () => void; label: string }> = ({ open, onOpen, onPick, onClose, label }) => (
  <li className="group relative ml-[23px] border-l border-gray-300 pl-5">
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      aria-expanded={open}
      className={cn(
        "absolute left-0 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
        open
          ? "border-black text-black opacity-100"
          : "border-gray-400 text-gray-500 opacity-0 hover:border-black hover:text-black focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
      )}>
      {open ? <X className="h-2.5 w-2.5" aria-hidden /> : <Plus className="h-2.5 w-2.5" aria-hidden />}
    </button>
    {open ? <StepTypeMenu onPick={onPick} onClose={onClose} compact /> : <span className="block h-5" />}
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
