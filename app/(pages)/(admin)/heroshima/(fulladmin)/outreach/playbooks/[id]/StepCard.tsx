"use client";

import { useEffect, useState, type FC, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, LoaderCircle, Trash2 } from "lucide-react";
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
import { BTN_LINK, ChipPicker, INPUT_SM, StatusChip } from "@/app/components/mail/ui";
import { dateTime, hours, n, numOrUndef } from "@/app/components/mail/format";

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
  <select aria-label={label} className={`${INPUT_SM} ${className ?? ""}`} value={value} onChange={(e) => onChange(e.target.value)}>
    {children}
  </select>
);

const Num: FC<{ label: string; value: number | undefined; onChange: (v: number) => void; min?: number; className?: string }> = ({ label, value, onChange, min = 0, className }) => (
  <input
    type="number"
    min={min}
    aria-label={label}
    className={`${INPUT_SM} w-20 tabular-nums ${className ?? ""}`}
    value={value ?? ""}
    onChange={(e) => onChange(numOrUndef(e.target.value) ?? 0)}
  />
);

/** One step as a card: its fields by type, move and remove, its numbers, and the people at it. */
const StepCard: FC<{
  step: Step;
  index: number;
  ctx: StepContext;
  stats: PlaybookStepStats | undefined;
  playbookId: string | null;
  onChange: (step: Step) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}> = ({ step, index, ctx, stats, playbookId, onChange, onMove, onRemove }) => {
  const [showPeople, setShowPeople] = useState(false);
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

  let body: ReactNode = null;
  switch (step.type) {
    case "wait":
      body = (
        <Line>
          Wait <Num label="Hours" value={step.hours} min={1} onChange={(v) => onChange({ ...step, hours: v })} /> hours
          {step.hours >= 24 ? <span className="text-xs text-gray-500">({+(step.hours / 24).toFixed(1)} days)</span> : null}
        </Line>
      );
      break;
    case "wait_for": {
      const what = step.what;
      const setWhat = (w: WaitForWhat) => onChange({ ...step, what: w });
      body = (
        <div className="flex flex-col gap-2">
          <Line>
            Wait for
            <Sel
              label="What"
              value={what.kind}
              onChange={(kind) =>
                setWhat(kind === "action" ? { kind, actionId: "" } : kind === "event" ? { kind, event: "subscription_started" } : { kind: kind as "click" | "feedback", stepId: "" })
              }>
              <option value="click">a click on a step&apos;s mail</option>
              <option value="feedback">feedback on a step&apos;s mail</option>
              <option value="action">an action</option>
              <option value="event">something to happen</option>
            </Sel>
            {what.kind === "click" || what.kind === "feedback" ? (
              <Sel label="Step" value={what.stepId} onChange={(stepId) => setWhat({ ...what, stepId })}>
                {sendOptions()}
              </Sel>
            ) : what.kind === "action" ? (
              <Sel label="Action" value={what.actionId} onChange={(actionId) => setWhat({ ...what, actionId })}>
                <option value="">Pick an action</option>
                {ctx.actions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Sel>
            ) : (
              <Sel label="Event" value={what.event} onChange={(event) => setWhat({ ...what, event: event as BuiltInEvent })}>
                {BUILT_IN_EVENTS.map((e) => (
                  <option key={e} value={e}>
                    {EVENT_LABELS[e]}
                  </option>
                ))}
              </Sel>
            )}
            up to <Num label="Hours" value={step.maxHours} min={1} onChange={(v) => onChange({ ...step, maxHours: v })} /> hours
          </Line>
          <Line>
            If it happens go to
            <Sel label="If it happens" value={step.onMatch} onChange={(v) => onChange({ ...step, onMatch: v })}>
              {jumpOptions}
            </Sel>
            , if not
            <Sel label="If not" value={step.onTimeout} onChange={(v) => onChange({ ...step, onTimeout: v })}>
              {jumpOptions}
            </Sel>
          </Line>
        </div>
      );
      break;
    }
    case "wait_offer": {
      const target = ctx.steps.find((s) => s.id === step.offerStepId);
      const offerStep = target?.type === "send" ? target : null;
      const offer = offerStep?.offer ? ctx.offers.find((o) => o.id === offerStep.offer?.offerId) : undefined;
      const valid = offerStep?.offer?.validHoursOverride ?? offer?.validHours;
      body = (
        <div className="flex flex-col gap-1">
          <Line>
            Wait until <Num label="Hours before expiry" value={step.hoursBeforeExpiry} min={1} onChange={(v) => onChange({ ...step, hoursBeforeExpiry: v })} /> hours before the code from
            <Sel label="Offer step" value={step.offerStepId} onChange={(offerStepId) => onChange({ ...step, offerStepId })}>
              {sendOptions((s) => s.type === "send" && Boolean(s.offer))}
            </Sel>
            expires
          </Line>
          {valid !== undefined ? <p className="text-xs text-gray-500">That code is valid for {hours(valid)}. The reminder can&apos;t be later than that.</p> : null}
        </div>
      );
      break;
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
      body = (
        <div className="flex flex-col gap-2">
          <Line>
            If
            <Sel label="Fact" value={c.fact} onChange={(fact) => onChange({ ...step, condition: defaultCondition(fact as ConditionFact, c) })}>
              {CONDITION_FACTS.map((f) => (
                <option key={f} value={f}>
                  {FACT_LABELS[f]}
                </option>
              ))}
            </Sel>
            {STEP_FACTS.includes(c.fact) ? (
              <Sel label="Of step" value={c.stepId ?? ""} onChange={(stepId) => setC({ stepId })}>
                {sendOptions()}
              </Sel>
            ) : null}
            {c.fact === "actionCount" ? (
              <>
                <Sel label="Action" value={c.actionId ?? ""} onChange={(actionId) => setC({ actionId })}>
                  <option value="">Pick an action</option>
                  {ctx.actions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Sel>
                in <Num label="Within days" value={c.withinDays} min={1} onChange={(v) => setC({ withinDays: v })} /> days
              </>
            ) : null}
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
          </Line>
          <Line>
            then go to
            <Sel label="Then" value={step.then} onChange={(v) => onChange({ ...step, then: v })}>
              {jumpOptions}
            </Sel>
            , else
            <Sel label="Else" value={step.else} onChange={(v) => onChange({ ...step, else: v })}>
              {jumpOptions}
            </Sel>
          </Line>
        </div>
      );
      break;
    }
    case "send":
      body = (
        <div className="flex flex-col gap-2">
          <Line>
            Send
            <Sel label="Template" value={step.templateId} onChange={(templateId) => onChange({ ...step, templateId })} className="max-w-xs">
              <option value="">Pick a template</option>
              {ctx.templates
                .filter((t) => !t.archived || t.id === step.templateId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Sel>
            {step.templateId ? (
              <Link href={`/heroshima/outreach/templates/${step.templateId}`} target="_blank" className="text-xs font-semibold hover:underline">
                Edit
              </Link>
            ) : null}
          </Line>
          <div className="text-sm">
            <p className="mb-1 text-xs font-semibold text-gray-600">With an offer (optional)</p>
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
      break;
    case "tag":
      body = (
        <Line>
          Tag them
          <input aria-label="Tag" className={`${INPUT_SM} w-40`} value={step.tag} maxLength={40} onChange={(e) => onChange({ ...step, tag: e.target.value.replace(/[^\w-]/g, "") })} placeholder="unhappy" />
          <span className="text-xs text-gray-500">Shows in Audience filters.</span>
        </Line>
      );
      break;
    case "stop":
      body = <p className="text-sm text-gray-600">They leave the playbook here.</p>;
      break;
  }

  return (
    <li className="relative rounded-md border border-gray-300 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-[#e1f073]">{index + 1}</span>
        <span className="text-xs font-bold uppercase tracking-wide">{STEP_LABELS[step.type]}</span>
        <span className="font-mono text-[10px] text-gray-400">{step.id}</span>
        {stats ? (
          <span className="ml-2 text-xs text-gray-600">
            <strong className="tabular-nums">{n(stats.inStep)}</strong> here
            {step.type === "send" ? (
              <>
                {" "}
                · sent {n(stats.sent)} · opened {n(stats.opened)} · clicked {n(stats.clicked)} · converted {n(stats.converted)}
              </>
            ) : null}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {playbookId ? (
            <button type="button" className={BTN_LINK} onClick={() => setShowPeople((v) => !v)} aria-expanded={showPeople}>
              {showPeople ? "Hide people" : "People here"}
            </button>
          ) : null}
          <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => onMove(1)} disabled={index === ctx.steps.length - 1}>
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </IconBtn>
          <IconBtn label="Remove step" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-[#b23c26]" aria-hidden />
          </IconBtn>
        </span>
      </div>
      {body}
      {showPeople && playbookId ? <RunList playbookId={playbookId} stepId={step.id} /> : null}
    </li>
  );
};

const Line: FC<{ children: ReactNode }> = ({ children }) => <div className="flex flex-wrap items-center gap-1.5 text-sm">{children}</div>;

const IconBtn: FC<{ label: string; onClick: () => void; disabled?: boolean; children: ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="rounded border border-gray-300 bg-white p-1 hover:border-black disabled:opacity-40">
    {children}
  </button>
);

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
    <div className="mt-3 border-t border-gray-200 pt-2">
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
                <Link href={`/heroshima/users/${r.userId}`} className="font-semibold hover:underline">
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
