// A playbook in words: the trigger, the rules and each step as one short line, for the list rows
// and the editor's flow cards. Pure, so the server list page and the client editor share it.

import {
  BOOLEAN_FACTS,
  FACE_LABELS,
  FACT_LABELS,
  OP_LABELS,
  STEP_FACTS,
  type BuiltInEvent,
  type FaceAnswer,
  type Goal,
  type MailAction,
  type MailAudience,
  type MailOffer,
  type MailTemplate,
  type PlaybookInput,
  type PlaybookStepStats,
  type Step,
  type Trigger,
} from "@/app/lib/mail/types";
import { n, offerLabel, pct, ratio } from "@/app/components/mail/format";

/** What someone does to enter, said in the present tense ("Signs up"). */
export const TRIGGER_VERBS: Record<BuiltInEvent, string> = {
  signup: "Signs up",
  subscriber_added: "Joins the mailing list",
  checkout_started: "Starts checkout",
  subscription_started: "Subscribes",
  subscription_ended: "Plan ends",
  credits_out: "Runs out of credits",
  resume_added: "Adds a resume",
  application_tracked: "Tracks an application",
};

export const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;

/** "Free", "Free and Basic", "Free, Basic and Pro" (or "or" for the last). */
export const listText = (items: string[], last = "and") => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`);

const planName = (p: string) => (p ? p[0].toUpperCase() + p.slice(1) : p);
const actionName = (id: string | undefined, actions: MailAction[], fallback = "an action") => (id ? (actions.find((a) => a.id === id)?.name ?? fallback) : fallback);
const timesText = (count: number) => (count === 1 ? "once" : `${n(count)} times`);

/** Hours as "2 days" when whole days, else "36 hours". */
export const durationWords = (h: number) => {
  const v = Number(h) || 0;
  return v >= 24 && v % 24 === 0 ? plural(v / 24, "day") : plural(v, "hour");
};

/** The trigger as a short sentence: "Signs up", "Viewed pricing, 2 times in 3 days", "Joins Lapsed users". */
export const triggerSentence = (t: Trigger | undefined, actions: MailAction[], audiences: MailAudience[]): string => {
  if (!t) return "No trigger";
  if (t.type === "event") return TRIGGER_VERBS[t.event] ?? t.event;
  if (t.type === "audience") return t.audienceId ? `Joins ${audiences.find((a) => a.id === t.audienceId)?.name ?? "an audience"}` : "Joins an audience (pick one)";
  if (!t.actionId) return "Does something (pick a trigger)";
  return `${actionName(t.actionId, actions, "An action")}, ${timesText(t.count)} in ${plural(t.withinDays, "day")}`;
};

/** The steps in a few words: "3 mails, 1 with an offer", "2 steps, no mail", "No steps yet". */
export const stepsSummary = (steps: Step[] | undefined): string => {
  const list = steps ?? [];
  if (!list.length) return "No steps yet";
  const sends = list.filter((s) => s.type === "send");
  if (!sends.length) return `${plural(list.length, "step")}, no mail`;
  const withOffer = sends.filter((s) => s.type === "send" && s.offer).length;
  return `${plural(sends.length, "mail")}${withOffer ? `, ${n(withOffer)} with an offer` : ""}`;
};

export const goalText = (g: Goal, actions: MailAction[]): string => {
  switch (g.type) {
    case "subscribed":
      return "goal: subscribes";
    case "event":
      return `goal: ${(TRIGGER_VERBS[g.event] ?? g.event).toLowerCase()}`;
    case "action":
      return `goal: ${g.actionId ? actionName(g.actionId, actions) : "pick an action"}`;
    case "feedback_answered":
      return "goal: answers the feedback";
    default:
      return "no goal";
  }
};

/** Who may enter, how often, holdout, goal and group, as one line: "Free and Basic · once · 10% holdout · goal: subscribes · group billing". */
export const rulesSentence = (f: Pick<PlaybookInput, "entry" | "reentry" | "goal" | "holdoutPercent" | "group">, actions: MailAction[]): string => {
  const e = f.entry ?? {};
  const parts: string[] = [];
  const who: string[] = [];
  if (e.plans?.length) who.push(listText(e.plans.map(planName)));
  if (e.notPlans?.length) who.push(`not ${listText(e.notPlans.map(planName), "or")}`);
  parts.push(who.length ? who.join(", ") : "Anyone");
  if (e.minAccountAgeDays) parts.push(`accounts ${n(e.minAccountAgeDays)}+ days old`);
  if (e.noOfferWithinDays) parts.push(`no offer in ${plural(e.noOfferWithinDays, "day")}`);
  const required = e.requireActions ?? [];
  if (required.length === 1) {
    const r = required[0];
    parts.push(`after ${actionName(r.actionId, actions)}${r.count > 1 ? ` ${n(r.count)}+ times` : ""}${r.withinDays ? ` in ${plural(r.withinDays, "day")}` : ""}`);
  } else if (required.length > 1) parts.push(`${n(required.length)} required actions`);
  parts.push(f.reentry?.mode === "after_days" ? `again after ${plural(f.reentry.days, "day")}` : "once");
  parts.push(f.holdoutPercent > 0 ? `${f.holdoutPercent}% holdout` : "no holdout");
  parts.push(goalText(f.goal ?? { type: "none" }, actions));
  if (f.group?.trim()) parts.push(`group ${f.group.trim()}`);
  return parts.join(" · ");
};

/** 1-based position of a step, or null when it is gone. */
export const stepNumber = (id: string | undefined, steps: Step[]) => {
  const i = id ? steps.findIndex((s) => s.id === id) : -1;
  return i >= 0 ? i + 1 : null;
};

const stepRef = (id: string | undefined, steps: Step[]) => {
  const at = stepNumber(id, steps);
  return at ? `step ${at}` : "a step (pick one)";
};

const valueText = (fact: string, value: unknown): string => {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.map((v) => valueText(fact, v)).join(" or ") : "(pick values)";
  if (fact === "feedback" && typeof value === "string") return FACE_LABELS[value as FaceAnswer] ?? value;
  if (fact === "plan" && typeof value === "string") return planName(value);
  if (typeof value === "number") return n(value);
  return value === null || value === undefined || value === "" ? "(pick a value)" : String(value);
};

export type StepLineContext = { steps: Step[]; templates: MailTemplate[]; offers: MailOffer[]; actions: MailAction[] };

/** One step as one line for its flow card. `missing` marks what still has to be picked. */
export const stepLine = (step: Step, ctx: StepLineContext): { text: string; missing?: boolean } => {
  switch (step.type) {
    case "send": {
      const template = ctx.templates.find((t) => t.id === step.templateId);
      if (!step.templateId) return { text: "Pick a template", missing: true };
      let text = `"${template?.name ?? "A removed template"}"`;
      if (step.offer) {
        const offer = ctx.offers.find((o) => o.id === step.offer?.offerId);
        const discount = step.offer.percentOverride !== undefined ? `${step.offer.percentOverride}%` : offer ? offerLabel(offer) : null;
        text += discount ? ` with ${discount} off` : " with an offer";
      }
      return { text, missing: !template };
    }
    case "wait":
      return { text: durationWords(step.hours) };
    case "wait_for": {
      const w = step.what;
      let what = "";
      if (w.kind === "click") what = `a click on ${stepRef(w.stepId, ctx.steps)}'s mail`;
      else if (w.kind === "feedback") what = `feedback on ${stepRef(w.stepId, ctx.steps)}'s mail`;
      else if (w.kind === "action") what = w.actionId ? actionName(w.actionId, ctx.actions) : "an action (pick one)";
      else what = (TRIGGER_VERBS[w.event] ?? w.event).toLowerCase();
      return { text: `${what}, up to ${durationWords(step.maxHours)}` };
    }
    case "wait_offer":
      return { text: `until ${durationWords(step.hoursBeforeExpiry)} before ${stepRef(step.offerStepId, ctx.steps)}'s code expires`, missing: !stepNumber(step.offerStepId, ctx.steps) };
    case "if": {
      const c = step.condition;
      let subject: string = FACT_LABELS[c.fact] ?? c.fact;
      if (STEP_FACTS.includes(c.fact)) {
        const ref = stepRef(c.stepId, ctx.steps);
        subject = c.fact === "redeemed" ? `Redeemed ${ref}'s offer` : c.fact === "feedback" ? `Feedback on ${ref}'s mail` : `${c.fact === "opened" ? "Opened" : "Clicked"} ${ref}'s mail`;
      }
      if (c.fact === "actionCount") subject = `${c.actionId ? actionName(c.actionId, ctx.actions) : "An action (pick one)"}${c.withinDays ? ` in ${plural(c.withinDays, "day")}` : ""}`;
      const value = BOOLEAN_FACTS.includes(c.fact) ? valueText(c.fact, c.value === false ? false : true) : valueText(c.fact, c.value);
      return { text: `${subject} ${OP_LABELS[c.op] ?? c.op} ${value}` };
    }
    case "tag":
      return step.tag.trim() ? { text: `Tag "${step.tag.trim()}"` } : { text: "Write the tag", missing: true };
    default:
      return { text: "They leave the playbook here" };
  }
};

/** A step's jumps as words: "then go to step 4 · else next step". Null when every jump is "next". */
export const jumpLine = (step: Step, steps: Step[]): { text: string; broken: boolean } | null => {
  const pairs: Array<[string, string]> =
    step.type === "if" ? [["then", step.then], ["else", step.else]] : step.type === "wait_for" ? [["if it happens,", step.onMatch], ["if not,", step.onTimeout]] : [];
  if (!pairs.length || pairs.every(([, v]) => v === "next")) return null;
  let broken = false;
  const text = pairs
    .map(([label, v]) => {
      if (v === "next") return `${label} next step`;
      const at = stepNumber(v, steps);
      if (!at) broken = true;
      return `${label} go to ${at ? `step ${at}` : "a removed step"}`;
    })
    .join(" · ");
  return { text, broken };
};

/** A step's numbers: "212 sent · 9% clicked · 14 here now". Null when there are none yet. */
export const statsLine = (step: Step, stats: PlaybookStepStats | undefined): string | null => {
  if (!stats) return null;
  const here = Number(stats.inStep) || 0;
  const sent = Number(stats.sent) || 0;
  if (step.type === "send" && sent > 0) return `${n(sent)} sent · ${pct(ratio(stats.clicked, sent), 0)} clicked · ${n(here)} here now`;
  return here > 0 ? `${n(here)} here now` : null;
};
