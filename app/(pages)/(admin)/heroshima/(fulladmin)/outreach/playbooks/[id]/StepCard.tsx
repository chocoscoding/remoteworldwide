"use client";

import { useEffect, useState, type FC, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CornerDownRight, LoaderCircle, Trash2 } from "lucide-react";
import { listPlaybookRuns } from "@/libs/mail-admin";
import {
  BOOLEAN_FACTS,
  BUILT_IN_EVENTS,
  CONDITION_FACTS,
  EVENT_LABELS,
  FACE_LABELS,
  FACES,
  FACT_LABELS,
  OP_LABELS,
  PLAN_KEYS,
  STEP_FACTS,
  STEP_LABELS,
  type BuiltInEvent,
  type Condition,
  type ConditionFact,
  type ConditionOp,
  type MailAction,
  type MailOffer,
  type MailTemplate,
  type Paged,
  type PlaybookRun,
  type PlaybookStepStats,
  type Step,
  type WaitForWhat,
} from "@/app/lib/mail/types";
import OfferPicker from "@/app/components/mail/OfferPicker";
import { BTN, BTN_DANGER, BTN_LINK, ChipPicker, INPUT_SM, StatusChip } from "@/app/components/mail/ui";
import { dateTime, hours, n, numOrUndef, pct, ratio } from "@/app/components/mail/format";
import { jumpLine, listText, statsLine, stepLine } from "@/app/components/mail/playbook/summary";
import { cn } from "@/lib/utils";

// A step three ways: the compact card in the flow (default export), its fields by type
// (StepFields) and the inspector that holds those fields with reorder, delete and the people at it
// (StepInspector). Only the selected step's fields are on screen at a time.

export type StepContext = {
  steps: Step[];
  templates: MailTemplate[];
  offers: MailOffer[];
  actions: MailAction[];
  maxDiscountPercent: number;
};

/** "Step 3: Send Still choosing" style, for pickers and summaries. */
export const stepName = (step: Step, index: number, ctx: Pick<StepContext, "templates">) => {
  let what: string = STEP_LABELS[step.type];
  if (step.type === "send") what = `Send "${ctx.templates.find((t) => t.id === step.templateId)?.name ?? "no template"}"`;
  if (step.type === "wait") what = `Wait ${hours(step.hours)}`;
  if (step.type === "tag") what = `Tag ${step.tag || "(none)"}`;
  return `Step ${index + 1}: ${what}`;
};

/** The numbers of the steps that jump to or read from `id`, so deleting it can say what changes. */
export const stepsPointingAt = (id: string, steps: Step[]) =>
  steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      if (s.id === id) return false;
      if (s.type === "wait_for") return s.onMatch === id || s.onTimeout === id || ((s.what.kind === "click" || s.what.kind === "feedback") && s.what.stepId === id);
      if (s.type === "if") return s.then === id || s.else === id || s.condition.stepId === id;
      if (s.type === "wait_offer") return s.offerStepId === id;
      return false;
    })
    .map(({ i }) => i + 1);

const NUMERIC_OPS: ConditionOp[] = ["gte", "lte", "eq", "neq"];
const opsFor = (fact: ConditionFact): ConditionOp[] => (BOOLEAN_FACTS.includes(fact) ? ["eq", "neq"] : fact === "plan" || fact === "feedback" ? ["eq", "neq", "in"] : NUMERIC_OPS);
const defaultCondition = (fact: ConditionFact, prev: Condition): Condition => {
  const base: Condition = { fact, op: opsFor(fact)[0], value: null };
  if (BOOLEAN_FACTS.includes(fact)) base.value = true;
  else if (fact === "plan") base.value = "free";
  else if (fact === "feedback") base.value = "great";
  else base.value = 1;
  if (STEP_FACTS.includes(fact)) base.stepId = prev.stepId ?? "";
  if (fact === "actionCount") {
    base.actionId = prev.actionId ?? "";
    base.withinDays = prev.withinDays ?? 7;
  }
  return base;
};

const Sel: FC<{ label: string; value: string; onChange: (v: string) => void; children: ReactNode; className?: string }> = ({ label, value, onChange, children, className }) => (
  <select aria-label={label} className={cn(INPUT_SM, "max-w-full", className)} value={value} onChange={(e) => onChange(e.target.value)}>
    {children}
  </select>
);

const Num: FC<{ label: string; value: number | undefined; onChange: (v: number) => void; min?: number; className?: string }> = ({ label, value, onChange, min = 0, className }) => (
  <input
    type="number"
    min={min}
    aria-label={label}
    className={cn(INPUT_SM, "w-20 tabular-nums", className)}
    value={value ?? ""}
    onChange={(e) => onChange(numOrUndef(e.target.value) ?? 0)}
  />
);

/** A labelled line of controls in the inspector. */
const Row: FC<{ label: string; children: ReactNode; hint?: ReactNode }> = ({ label, children, hint }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-gray-600">{label}</span>
    <div className="flex flex-wrap items-center gap-1.5 text-sm">{children}</div>
    {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
  </div>
);

/** One step's own fields, by type. */
export const StepFields: FC<{ step: Step; ctx: StepContext; onChange: (step: Step) => void }> = ({ step, ctx, onChange }) => {
  const others = ctx.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.id !== step.id);
  const sendSteps = ctx.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.type === "send" && s.id !== step.id);
  const jumpOptions = (
    <>
      <option value="next">Next step</option>
      {others.map(({ s, i }) => (
        <option key={s.id} value={s.id}>
          {stepName(s, i, ctx)}
        </option>
      ))}
    </>
  );
  const sendOptions = (filter?: (s: Step) => boolean) => (
    <>
      <option value="">Pick a send step</option>
      {sendSteps
        .filter(({ s }) => (filter ? filter(s) : true))
        .map(({ s, i }) => (
          <option key={s.id} value={s.id}>
            {stepName(s, i, ctx)}
          </option>
        ))}
    </>
  );
  const actionOptions = (
    <>
      <option value="">Pick an action</option>
      {ctx.actions.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </>
  );

  switch (step.type) {
    case "wait":
      return (
        <Row label="Wait">
          <Num label="Hours" value={step.hours} min={1} onChange={(v) => onChange({ ...step, hours: v })} /> hours
          {step.hours >= 24 ? <span className="text-xs text-gray-500">({+(step.hours / 24).toFixed(1)} days)</span> : null}
        </Row>
      );
    case "wait_for": {
      const what = step.what;
      const setWhat = (w: WaitForWhat) => onChange({ ...step, what: w });
      return (
        <div className="flex flex-col gap-3">
          <Row label="Wait for">
            <Sel
              label="What"
              value={what.kind}
              className="w-full"
              onChange={(kind) =>
                setWhat(kind === "action" ? { kind, actionId: "" } : kind === "event" ? { kind, event: "subscription_started" } : { kind: kind as "click" | "feedback", stepId: "" })
              }>
              <option value="click">a click on a step&apos;s mail</option>
              <option value="feedback">feedback on a step&apos;s mail</option>
              <option value="action">an action</option>
              <option value="event">something to happen</option>
            </Sel>
            {what.kind === "click" || what.kind === "feedback" ? (
              <Sel label="Step" value={what.stepId} className="w-full" onChange={(stepId) => setWhat({ ...what, stepId })}>
                {sendOptions()}
              </Sel>
            ) : what.kind === "action" ? (
              <Sel label="Action" value={what.actionId} className="w-full" onChange={(actionId) => setWhat({ ...what, actionId })}>
                {actionOptions}
              </Sel>
            ) : (
              <Sel label="Event" value={what.event} className="w-full" onChange={(event) => setWhat({ ...what, event: event as BuiltInEvent })}>
                {BUILT_IN_EVENTS.map((e) => (
                  <option key={e} value={e}>
                    {EVENT_LABELS[e]}
                  </option>
                ))}
              </Sel>
            )}
          </Row>
          <Row label="For at most">
            <Num label="Hours" value={step.maxHours} min={1} onChange={(v) => onChange({ ...step, maxHours: v })} /> hours
          </Row>
          <Row label="If it happens, go to">
            <Sel label="If it happens" value={step.onMatch} className="w-full" onChange={(v) => onChange({ ...step, onMatch: v })}>
              {jumpOptions}
            </Sel>
          </Row>
          <Row label="If not, go to">
            <Sel label="If not" value={step.onTimeout} className="w-full" onChange={(v) => onChange({ ...step, onTimeout: v })}>
              {jumpOptions}
            </Sel>
          </Row>
        </div>
      );
    }
    case "wait_offer": {
      const target = ctx.steps.find((s) => s.id === step.offerStepId);
      const offerStep = target?.type === "send" ? target : null;
      const offer = offerStep?.offer ? ctx.offers.find((o) => o.id === offerStep.offer?.offerId) : undefined;
      const valid = offerStep?.offer?.validHoursOverride ?? offer?.validHours;
      return (
        <div className="flex flex-col gap-3">
          <Row label="The code from">
            <Sel label="Offer step" value={step.offerStepId} className="w-full" onChange={(offerStepId) => onChange({ ...step, offerStepId })}>
              {sendOptions((s) => s.type === "send" && Boolean(s.offer))}
            </Sel>
          </Row>
          <Row label="Wait until" hint={valid !== undefined ? <>That code is valid for {hours(valid)}. The reminder can&apos;t be later than that.</> : undefined}>
            <Num label="Hours before expiry" value={step.hoursBeforeExpiry} min={1} onChange={(v) => onChange({ ...step, hoursBeforeExpiry: v })} /> hours before it expires
          </Row>
        </div>
      );
    }
    case "if": {
      const c = step.condition;
      const setC = (next: Partial<Condition>) => onChange({ ...step, condition: { ...c, ...next } });
      let value: ReactNode;
      if (BOOLEAN_FACTS.includes(c.fact)) {
        value = (
          <Sel label="Value" value={c.value === false ? "no" : "yes"} onChange={(v) => setC({ value: v === "yes" })}>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </Sel>
        );
      } else if (c.fact === "plan" || c.fact === "feedback") {
        const opts = c.fact === "plan" ? PLAN_KEYS.map((p) => ({ value: p as string, label: p })) : FACES.map((f) => ({ value: f as string, label: FACE_LABELS[f] }));
        value =
          c.op === "in" ? (
            <ChipPicker label="Values" values={Array.isArray(c.value) ? (c.value as string[]) : []} options={opts} onChange={(v) => setC({ value: v })} />
          ) : (
            <Sel label="Value" value={typeof c.value === "string" ? c.value : opts[0].value} onChange={(v) => setC({ value: v })}>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Sel>
          );
      } else {
        value = <Num label="Value" value={typeof c.value === "number" ? c.value : undefined} onChange={(v) => setC({ value: v })} />;
      }
      return (
        <div className="flex flex-col gap-3">
          <Row label="If">
            <Sel label="Fact" value={c.fact} className="w-full" onChange={(fact) => onChange({ ...step, condition: defaultCondition(fact as ConditionFact, c) })}>
              {CONDITION_FACTS.map((f) => (
                <option key={f} value={f}>
                  {FACT_LABELS[f]}
                </option>
              ))}
            </Sel>
            {STEP_FACTS.includes(c.fact) ? (
              <Sel label="Of step" value={c.stepId ?? ""} className="w-full" onChange={(stepId) => setC({ stepId })}>
                {sendOptions()}
              </Sel>
            ) : null}
            {c.fact === "actionCount" ? (
              <>
                <Sel label="Action" value={c.actionId ?? ""} className="w-full" onChange={(actionId) => setC({ actionId })}>
                  {actionOptions}
                </Sel>
                in the last <Num label="Within days" value={c.withinDays} min={1} onChange={(v) => setC({ withinDays: v })} /> days
              </>
            ) : null}
          </Row>
          <Row label="Is">
            <Sel
              label="Operator"
              value={c.op}
              onChange={(op) => setC({ op: op as ConditionOp, value: op === "in" ? (Array.isArray(c.value) ? c.value : typeof c.value === "string" ? [c.value] : []) : Array.isArray(c.value) ? (c.value[0] ?? null) : c.value })}>
              {opsFor(c.fact).map((op) => (
                <option key={op} value={op}>
                  {OP_LABELS[op]}
                </option>
              ))}
            </Sel>
            {value}
          </Row>
          <Row label="Then go to">
            <Sel label="Then" value={step.then} className="w-full" onChange={(v) => onChange({ ...step, then: v })}>
              {jumpOptions}
            </Sel>
          </Row>
          <Row label="Else go to">
            <Sel label="Else" value={step.else} className="w-full" onChange={(v) => onChange({ ...step, else: v })}>
              {jumpOptions}
            </Sel>
          </Row>
        </div>
      );
    }
    case "send":
      return (
        <div className="flex flex-col gap-3">
          <Row
            label="Send"
            hint={
              step.templateId ? (
                <Link href={`/heroshima/outreach/templates/${step.templateId}`} target="_blank" className="font-semibold text-gray-700 hover:underline">
                  Edit this mail (opens a new tab)
                </Link>
              ) : undefined
            }>
            <Sel label="Template" value={step.templateId} className="w-full" onChange={(templateId) => onChange({ ...step, templateId })}>
              <option value="">Pick a template</option>
              {ctx.templates
                .filter((t) => !t.archived || t.id === step.templateId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Sel>
          </Row>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold text-gray-600">With an offer (optional)</span>
            <OfferPicker
              offers={ctx.offers}
              value={step.offer}
              onChange={(offer) => {
                const next: Step = { ...step };
                if (offer) next.offer = offer;
                else delete next.offer;
                onChange(next);
              }}
              maxDiscountPercent={ctx.maxDiscountPercent}
            />
          </div>
        </div>
      );
    case "tag":
      return (
        <Row label="Tag them" hint="Shows in Audience filters.">
          <input aria-label="Tag" className={`${INPUT_SM} w-48`} value={step.tag} maxLength={40} onChange={(e) => onChange({ ...step, tag: e.target.value.replace(/[^\w-]/g, "") })} placeholder="unhappy" />
        </Row>
      );
    default:
      return <p className="text-sm text-gray-600">They leave the playbook here.</p>;
  }
};

/** A step in the flow: its number, type, one line, its numbers and where it jumps. Pressing it opens the inspector. */
const StepCard: FC<{
  step: Step;
  index: number;
  ctx: StepContext;
  stats: PlaybookStepStats | undefined;
  selected: boolean;
  onSelect: () => void;
}> = ({ step, index, ctx, stats, selected, onSelect }) => {
  const line = stepLine(step, ctx);
  const jumps = jumpLine(step, ctx.steps);
  const numbers = statsLine(step, stats);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Step ${index + 1}, ${STEP_LABELS[step.type]}: ${line.text}`}
      className={cn("block w-full rounded-md bg-white px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black", selected ? "br-shadow" : "br-plain-press")}>
      <span className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold", selected ? "bg-[#e1f073] text-black ring-1 ring-black" : "bg-black text-[#e1f073]")}>
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">{STEP_LABELS[step.type]}</span>
          <span className={cn("block truncate text-sm", line.missing ? "text-[#b23c26]" : "text-black")}>{line.text}</span>
          {jumps ? (
            <span className={cn("mt-0.5 flex items-center gap-1 text-xs", jumps.broken ? "text-[#b23c26]" : "text-gray-600")}>
              <CornerDownRight className="h-3 w-3 flex-none" aria-hidden />
              <span className="truncate">{jumps.text}</span>
            </span>
          ) : null}
          {numbers ? <span className="mt-1 block text-xs tabular-nums text-gray-500">{numbers}</span> : null}
        </span>
      </span>
    </button>
  );
};

const IconBtn: FC<{ label: string; onClick: () => void; disabled?: boolean; children: ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="rounded border border-gray-300 bg-white p-1 hover:border-black disabled:opacity-40">
    {children}
  </button>
);

/** The selected step in the inspector: reorder, delete, its fields, its numbers and the people at it. Keyed by step id, so the delete question resets per step. */
export const StepInspector: FC<{
  step: Step;
  index: number;
  ctx: StepContext;
  stats: PlaybookStepStats | undefined;
  playbookId: string | null;
  onChange: (step: Step) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}> = ({ step, index, ctx, stats, playbookId, onChange, onMove, onRemove }) => {
  const [askDelete, setAskDelete] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const pointing = askDelete ? stepsPointingAt(step.id, ctx.steps) : [];
  const sent = Number(stats?.sent) || 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-black text-xs font-bold text-[#e1f073]">{index + 1}</span>
        <h2 className="text-sm font-bold">
          Step {index + 1} · {STEP_LABELS[step.type]}
        </h2>
        <span className="font-mono text-[10px] text-gray-400">{step.id}</span>
        <span className="ml-auto flex items-center gap-1">
          <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => onMove(1)} disabled={index === ctx.steps.length - 1}>
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </IconBtn>
        </span>
      </div>

      {stats && (sent > 0 || Number(stats.inStep) > 0) ? (
        <p className="text-xs tabular-nums text-gray-600">
          <strong className="text-black">{n(stats.inStep)}</strong> here now
          {step.type === "send" ? (
            <>
              {" "}
              · {n(sent)} sent · {n(stats.opened)} opened · {n(stats.clicked)} clicked ({pct(ratio(stats.clicked, sent), 0)}) · {n(stats.converted)} converted
            </>
          ) : null}
        </p>
      ) : null}

      <StepFields step={step} ctx={ctx} onChange={onChange} />

      {playbookId ? (
        <div className="border-t border-gray-200 pt-3">
          <button type="button" className={BTN_LINK} onClick={() => setShowPeople((v) => !v)} aria-expanded={showPeople}>
            {showPeople ? "Hide people" : "People at this step"}
          </button>
          {showPeople ? <RunList playbookId={playbookId} stepId={step.id} /> : null}
        </div>
      ) : null}

      <div className="border-t border-gray-200 pt-3">
        {askDelete ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Delete step {index + 1}?
              {pointing.length ? (
                <span className="block text-xs text-gray-600">
                  {pointing.length === 1 ? "Step" : "Steps"} {listText(pointing.map(String))} {pointing.length === 1 ? "points" : "point"} at it. Jumps to it become &quot;Next step&quot; and picks of it are cleared.
                </span>
              ) : null}
            </p>
            <span className="flex gap-2">
              <button type="button" className={BTN_DANGER} onClick={onRemove}>
                Yes, delete
              </button>
              <button type="button" className={BTN} onClick={() => setAskDelete(false)}>
                Keep
              </button>
            </span>
          </div>
        ) : (
          <button type="button" className={`${BTN_DANGER} gap-1.5`} onClick={() => setAskDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete step
          </button>
        )}
      </div>
    </div>
  );
};

/** The people at one step, a page at a time. */
const RunList: FC<{ playbookId: string; stepId: string }> = ({ playbookId, stepId }) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<PlaybookRun> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${stepId}:${page}`;

  useEffect(() => {
    let live = true;
    listPlaybookRuns(playbookId, { stepId, page }).then(
      (res) => {
        if (!live) return;
        setLoadedKey(`${stepId}:${page}`);
        if (res.error) setError(res.error);
        else {
          setError(null);
          setData(res.data ?? null);
        }
      },
      () => {
        if (!live) return;
        setLoadedKey(`${stepId}:${page}`);
        setError("The people couldn't be loaded.");
      },
    );
    return () => {
      live = false;
    };
  }, [playbookId, stepId, page]);

  const loading = loadedKey !== key;
  return (
    <div className="mt-2">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading people
        </p>
      ) : error ? (
        <p className="text-xs text-[#b23c26]">{error}</p>
      ) : !data?.items.length ? (
        <p className="text-xs text-gray-500">Nobody at this step now.</p>
      ) : (
        <>
          <ul className="flex flex-col text-sm">
            {data.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-1.5">
                <Link href={`/heroshima/users/${r.userId}`} className="min-w-0 truncate font-semibold hover:underline">
                  {r.email || r.userId}
                </Link>
                <StatusChip status={r.status} />
                <span className="text-xs text-gray-500">
                  entered {dateTime(r.enteredAt)}
                  {r.nextAt ? ` · next ${dateTime(r.nextAt)}` : ""}
                  {r.version ? ` · v${r.version}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-3 text-xs">
            {page > 1 ? (
              <button type="button" className={BTN_LINK} onClick={() => setPage(page - 1)}>
                Previous
              </button>
            ) : null}
            <span className="text-gray-500">
              Page {data.page} of {data.pages} · {n(data.total)} people
            </span>
            {page < data.pages ? (
              <button type="button" className={BTN_LINK} onClick={() => setPage(page + 1)}>
                Next
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default StepCard;
