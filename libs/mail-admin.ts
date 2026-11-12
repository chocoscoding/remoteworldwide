"use server";

// The admin Outreach section (/heroshima/outreach) talks to the backend through these server actions, the
// analytics-admin pattern (libs/analytics-admin.ts): each forwards the admin's own session cookie
// and the backend's isAdmin on /api/admin/mail is the boundary; requireAdminAction refuses a
// non-admin here first. Shapes: MAIL-BUILD-SPEC.md section 7, typed in app/lib/mail/types.ts.
//
// Every action answers `{ data }` or `{ error }` instead of throwing a backend refusal, because a
// production build hides a thrown action's message (and the preview's 502 "The mail service is
// not reachable" has to reach the screen). Only the admin check itself throws.

import { requireAdminAction } from "@/app/lib/auth/action-guards";
import { BackendError, backend, idSegment, isObjectId, type BackendInit } from "@/app/lib/backend";
import type {
  ActionInput,
  AudienceCount,
  AudienceFilter,
  AudienceInput,
  AuditRow,
  CampaignInput,
  CampaignReport,
  MailAction,
  MailAudience,
  MailCampaign,
  MailOffer,
  MailPlaybook,
  MailPreview,
  MailResult,
  MailSettings,
  MailTemplate,
  MailThread,
  OfferInput,
  Overview,
  Paged,
  PlaybookInput,
  PlaybookReport,
  PlaybookRun,
  PlaybookStatus,
  RunStatus,
  SettingsInput,
  TableBy,
  TableRow,
  TemplateContent,
  TemplateInput,
  ThreadDetail,
  ThreadStatus,
} from "@/app/lib/mail/types";

/** A write body without Mongo `_id` keys (a document read back and edited must not try to set them). */
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== "_id")
      .map(([k, v]) => [k, strip(v)]),
  );
}

const mail = <T>(path: string, init: Omit<BackendInit, "session"> = {}) =>
  backend<T>(`/admin/mail${path}`, { ...init, body: init.body === undefined ? undefined : strip(init.body), session: true });

const int = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(value)) || fallback));

/** A Mongo document as sent raw: copy `_id` to `id` everywhere, so the screens read one name. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalize(v);
  if (out.id === undefined && out._id !== undefined && out._id !== null) out.id = String(out._id);
  return out;
}

/** A list the backend may send bare or inside `{ items }` / `{ rows }` / a named key. */
function listOf<T>(raw: unknown, ...keys: string[]): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    for (const key of [...keys, "items", "rows", "data"]) {
      const v = (raw as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

function pagedOf<T>(raw: unknown, page: number, ...keys: string[]): Paged<T> {
  const items = listOf<T>(raw, ...keys);
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const total = Number(obj.total ?? obj.count ?? items.length) || 0;
  const current = Number(obj.page ?? page) || page;
  // Pages as sent, else from the page size as sent, else from page 1's length; failing all, this page is the last known.
  const size = Number(obj.limit ?? obj.pageSize ?? obj.perPage ?? 0) || (current === 1 ? items.length : 0);
  const pages = Number(obj.pages ?? 0) || (size ? Math.ceil(total / size) : current);
  return { items, total, page: current, pages: Math.max(1, pages, current) };
}

/** Runs one backend call: the data, normalized, or a refusal's message. */
async function run<T>(call: () => Promise<unknown>, shape: (raw: unknown) => T = (raw) => raw as T): Promise<MailResult<T>> {
  try {
    return { data: shape(normalize(await call())) };
  } catch (error) {
    if (error instanceof BackendError) return { error: error.message || `The backend answered ${error.status}.` };
    // fetch rejects with a TypeError when the backend is down.
    if (error instanceof TypeError) return { error: "The backend is not reachable." };
    throw error;
  }
}

const bad = (message: string): MailResult<never> => ({ error: message });
const okId = (id: unknown) => isObjectId(id);

/* ----------------------------------------------------------------------------- settings */

export const getMailSettings = async () => {
  await requireAdminAction();
  return run<MailSettings>(
    () => mail("/settings"),
    (raw) => ((raw as { settings?: MailSettings })?.settings ?? raw) as MailSettings,
  );
};

export const saveMailSettings = async (changes: SettingsInput) => {
  await requireAdminAction();
  return run<MailSettings>(
    () => mail("/settings", { method: "PUT", body: changes }),
    (raw) => ((raw as { settings?: MailSettings })?.settings ?? raw) as MailSettings,
  );
};

/** The audit log. Read from GET /settings's `audit` when the backend sends it there, else GET /audit. */
export const getMailAudit = async (page = 1) => {
  await requireAdminAction();
  const p = int(page, 1, 1, 100_000);
  const fromSettings = await run<AuditRow[] | null>(
    () => mail("/settings"),
    (raw) => {
      const audit = (raw as { audit?: unknown })?.audit;
      return audit === undefined ? null : listOf<AuditRow>(audit);
    },
  );
  if (fromSettings.data && p === 1) return { data: { items: fromSettings.data, total: fromSettings.data.length, page: 1, pages: 1 } } as MailResult<Paged<AuditRow>>;
  return run<Paged<AuditRow>>(() => mail(`/audit?page=${p}`), (raw) => pagedOf<AuditRow>(raw, p, "audit"));
};

/** Seeds the starter templates, actions and playbooks (idempotent). */
export const ensureMailDefaults = async () => {
  await requireAdminAction();
  return run<unknown>(() => mail("/defaults", { method: "POST" }));
};

/* ----------------------------------------------------------------------------- templates */

export const listTemplates = async ({ archived = false }: { archived?: boolean } = {}) => {
  await requireAdminAction();
  return run(() => mail(`/templates?archived=${archived ? "true" : "false"}`), (raw) => listOf<MailTemplate>(raw, "templates"));
};

export const getTemplate = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Template not found");
  return run<MailTemplate>(() => mail(`/templates/${idSegment(id)}`));
};

export const createTemplate = async (input: TemplateInput) => {
  await requireAdminAction();
  return run<MailTemplate>(() => mail("/templates", { method: "POST", body: input }));
};

export const updateTemplate = async (id: string, input: Partial<TemplateInput>) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Template not found");
  return run<MailTemplate>(() => mail(`/templates/${idSegment(id)}`, { method: "PUT", body: input }));
};

export const archiveTemplate = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Template not found");
  return run<unknown>(() => mail(`/templates/${idSegment(id)}/archive`, { method: "POST" }));
};

export const duplicateTemplate = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Template not found");
  return run<MailTemplate>(() => mail(`/templates/${idSegment(id)}/duplicate`, { method: "POST" }));
};

/** Renders content as the events service would send it. 502 "The mail service is not reachable" comes back as `error`. */
export const previewMail = async ({ content, userId, sampleOffer = true }: { content: TemplateContent; userId?: string; sampleOffer?: boolean }) => {
  await requireAdminAction();
  const body: Record<string, unknown> = { content, sampleOffer: Boolean(sampleOffer) };
  if (userId && okId(userId)) body.userId = userId;
  return run<MailPreview>(() => mail("/preview", { method: "POST", body }));
};

/** Sends a test (subject prefixed "[Test]") to `to`, or to the admin's own address when empty. */
export const sendTestMail = async ({ content, to, userId }: { content: TemplateContent; to?: string; userId?: string }) => {
  await requireAdminAction();
  const body: Record<string, unknown> = { content };
  const address = typeof to === "string" ? to.trim().slice(0, 254) : "";
  if (address) body.to = address;
  if (userId && okId(userId)) body.userId = userId;
  return run<{ ok: boolean; sendId?: string }>(() => mail("/test", { method: "POST", body }));
};

/* ----------------------------------------------------------------------------- audiences */

export const listAudiences = async () => {
  await requireAdminAction();
  return run(() => mail("/audiences"), (raw) => listOf<MailAudience>(raw, "audiences"));
};

export const getAudience = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Audience not found");
  return run<MailAudience>(() => mail(`/audiences/${idSegment(id)}`));
};

export const createAudience = async (input: AudienceInput) => {
  await requireAdminAction();
  return run<MailAudience>(() => mail("/audiences", { method: "POST", body: input }));
};

export const updateAudience = async (id: string, input: AudienceInput) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Audience not found");
  return run<MailAudience>(() => mail(`/audiences/${idSegment(id)}`, { method: "PUT", body: input }));
};

export const deleteAudience = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Audience not found");
  return run<unknown>(() => mail(`/audiences/${idSegment(id)}`, { method: "DELETE" }));
};

/** How many people a filter reaches now, and 20 of them. */
export const countAudience = async (filter: AudienceFilter) => {
  await requireAdminAction();
  return run<AudienceCount>(
    () => mail("/audiences/count", { method: "POST", body: { filter } }),
    (raw) => {
      const r = (raw ?? {}) as Partial<AudienceCount>;
      return { count: Number(r.count ?? 0) || 0, sample: Array.isArray(r.sample) ? r.sample : [] };
    },
  );
};

/* ----------------------------------------------------------------------------- campaigns */

export const listCampaigns = async () => {
  await requireAdminAction();
  return run(() => mail("/campaigns"), (raw) => listOf<MailCampaign>(raw, "campaigns"));
};

export const getCampaign = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Campaign not found");
  return run<MailCampaign>(() => mail(`/campaigns/${idSegment(id)}`));
};

export const createCampaign = async (input: CampaignInput) => {
  await requireAdminAction();
  return run<MailCampaign>(() => mail("/campaigns", { method: "POST", body: input }));
};

export const updateCampaign = async (id: string, input: CampaignInput) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Campaign not found");
  return run<MailCampaign>(() => mail(`/campaigns/${idSegment(id)}`, { method: "PUT", body: input }));
};

/** `sendAt` null sends now. Over 500 people the backend wants `confirmCount` equal to the live count. */
export const scheduleCampaign = async (id: string, { sendAt, confirmCount }: { sendAt: string | null; confirmCount?: number }) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Campaign not found");
  const body: Record<string, unknown> = { sendAt: sendAt && !Number.isNaN(Date.parse(sendAt)) ? new Date(sendAt).toISOString() : null };
  if (confirmCount !== undefined) body.confirmCount = int(confirmCount, 0, 0, 100_000_000);
  return run<MailCampaign>(() => mail(`/campaigns/${idSegment(id)}/schedule`, { method: "POST", body }));
};

const campaignAction = async (id: string, action: "cancel" | "pause" | "resume" | "duplicate") => {
  if (!okId(id)) return bad("Campaign not found");
  return run<MailCampaign>(() => mail(`/campaigns/${idSegment(id)}/${action}`, { method: "POST" }));
};

export const cancelCampaign = async (id: string) => {
  await requireAdminAction();
  return campaignAction(id, "cancel");
};

export const pauseCampaign = async (id: string) => {
  await requireAdminAction();
  return campaignAction(id, "pause");
};

export const resumeCampaign = async (id: string) => {
  await requireAdminAction();
  return campaignAction(id, "resume");
};

export const duplicateCampaign = async (id: string) => {
  await requireAdminAction();
  return campaignAction(id, "duplicate");
};

export const pickCampaignWinner = async (id: string, variant: "a" | "b") => {
  await requireAdminAction();
  if (!okId(id)) return bad("Campaign not found");
  if (variant !== "a" && variant !== "b") return bad("Pick A or B");
  return run<MailCampaign>(() => mail(`/campaigns/${idSegment(id)}/winner`, { method: "POST", body: { variant } }));
};

/* ----------------------------------------------------------------------------- playbooks */

export const listPlaybooks = async () => {
  await requireAdminAction();
  return run(() => mail("/playbooks"), (raw) => listOf<MailPlaybook>(raw, "playbooks"));
};

export const getPlaybook = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Playbook not found");
  return run<MailPlaybook>(() => mail(`/playbooks/${idSegment(id)}`));
};

export const createPlaybook = async (input: PlaybookInput) => {
  await requireAdminAction();
  return run<MailPlaybook>(() => mail("/playbooks", { method: "POST", body: input }));
};

export const updatePlaybook = async (id: string, input: PlaybookInput) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Playbook not found");
  return run<MailPlaybook>(() => mail(`/playbooks/${idSegment(id)}`, { method: "PUT", body: input }));
};

export const setPlaybookStatus = async (id: string, status: PlaybookStatus) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Playbook not found");
  if (!["draft", "live", "paused"].includes(status)) return bad("Unknown status");
  return run<MailPlaybook>(() => mail(`/playbooks/${idSegment(id)}/status`, { method: "POST", body: { status } }));
};

const RUN_STATUSES: readonly RunStatus[] = ["active", "waiting", "done", "exited", "failed", "holdout"];

/** The people in a playbook, optionally only those at one step or in one status. */
export const listPlaybookRuns = async (id: string, { stepId, status, page = 1 }: { stepId?: string; status?: RunStatus; page?: number } = {}) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Playbook not found");
  const p = int(page, 1, 1, 100_000);
  const params = new URLSearchParams({ page: String(p) });
  if (typeof stepId === "string" && /^[\w-]{1,64}$/.test(stepId)) params.set("stepId", stepId);
  if (status && RUN_STATUSES.includes(status)) params.set("status", status);
  return run(() => mail(`/playbooks/${idSegment(id)}/runs?${params.toString()}`), (raw) => pagedOf<PlaybookRun>(raw, p, "runs", "people"));
};

/* ----------------------------------------------------------------------------- actions */

export const listMailActions = async () => {
  await requireAdminAction();
  return run(() => mail("/actions"), (raw) => listOf<MailAction>(raw, "actions"));
};

export const createMailAction = async (input: ActionInput) => {
  await requireAdminAction();
  return run<MailAction>(() => mail("/actions", { method: "POST", body: input }));
};

export const updateMailAction = async (id: string, input: ActionInput) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Action not found");
  return run<MailAction>(() => mail(`/actions/${idSegment(id)}`, { method: "PUT", body: input }));
};

export const archiveMailAction = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Action not found");
  return run<unknown>(() => mail(`/actions/${idSegment(id)}/archive`, { method: "POST" }));
};

/* ----------------------------------------------------------------------------- offers */

export const listOffers = async () => {
  await requireAdminAction();
  return run(() => mail("/offers"), (raw) => listOf<MailOffer>(raw, "offers"));
};

export const getOffer = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Offer not found");
  return run<MailOffer>(
    () => mail(`/offers/${idSegment(id)}`),
    (raw) => {
      // Either the offer itself, or `{ offer, stats, grants, daily }`.
      const r = raw as { offer?: MailOffer; stats?: MailOffer["stats"]; grants?: MailOffer["grants"]; daily?: MailOffer["daily"] };
      return r?.offer ? { ...r.offer, stats: r.stats ?? r.offer.stats, grants: r.grants ?? r.offer.grants, daily: r.daily ?? r.offer.daily } : (raw as MailOffer);
    },
  );
};

export const createOffer = async (input: OfferInput) => {
  await requireAdminAction();
  return run<MailOffer>(() => mail("/offers", { method: "POST", body: input }));
};

export const updateOffer = async (id: string, input: OfferInput) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Offer not found");
  return run<MailOffer>(() => mail(`/offers/${idSegment(id)}`, { method: "PUT", body: input }));
};

export const archiveOffer = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Offer not found");
  return run<unknown>(() => mail(`/offers/${idSegment(id)}/archive`, { method: "POST" }));
};

/* ----------------------------------------------------------------------------- inbox */

export const listThreads = async ({ status = "open", page = 1 }: { status?: ThreadStatus; page?: number } = {}) => {
  await requireAdminAction();
  const p = int(page, 1, 1, 100_000);
  const s: ThreadStatus = status === "done" ? "done" : "open";
  return run(() => mail(`/inbox?status=${s}&page=${p}`), (raw) => pagedOf<MailThread>(raw, p, "threads"));
};

export const getThread = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Conversation not found");
  return run<ThreadDetail>(
    () => mail(`/inbox/${idSegment(id)}`),
    (raw) => {
      const r = (raw ?? {}) as Partial<ThreadDetail> & Record<string, unknown>;
      return { thread: r.thread as ThreadDetail["thread"], messages: Array.isArray(r.messages) ? r.messages : [], person: (r.person ?? null) as ThreadDetail["person"] };
    },
  );
};

export const replyToThread = async (id: string, text: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Conversation not found");
  const body = typeof text === "string" ? text.trim().slice(0, 20_000) : "";
  if (!body) return bad("Write a reply first");
  return run<{ ok: boolean; sendId?: string }>(() => mail(`/inbox/${idSegment(id)}/reply`, { method: "POST", body: { text: body } }));
};

export const setThreadStatus = async (id: string, status: ThreadStatus) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Conversation not found");
  return run<unknown>(() => mail(`/inbox/${idSegment(id)}/status`, { method: "POST", body: { status: status === "done" ? "done" : "open" } }));
};

export const markThreadRead = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Conversation not found");
  return run<unknown>(() => mail(`/inbox/${idSegment(id)}/read`, { method: "POST" }));
};

/* ----------------------------------------------------------------------------- analytics */

const TABLE_BY: readonly TableBy[] = ["campaign", "playbook_step", "template", "kind"];

export const getMailOverview = async (days = 30) => {
  await requireAdminAction();
  return run<Overview>(() => mail(`/analytics/overview?days=${int(days, 30, 1, 365)}`));
};

export const getMailTable = async (by: TableBy, days = 30) => {
  await requireAdminAction();
  const b = TABLE_BY.includes(by) ? by : "campaign";
  return run(() => mail(`/analytics/table?by=${b}&days=${int(days, 30, 1, 365)}`), (raw) => listOf<TableRow>(raw, "rows"));
};

export const getCampaignReport = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Campaign not found");
  return run<CampaignReport>(() => mail(`/analytics/campaigns/${idSegment(id)}`));
};

export const getPlaybookReport = async (id: string) => {
  await requireAdminAction();
  if (!okId(id)) return bad("Playbook not found");
  return run<PlaybookReport>(
    () => mail(`/analytics/playbooks/${idSegment(id)}`),
    (raw) => {
      const r = (raw ?? {}) as Partial<PlaybookReport>;
      return { steps: Array.isArray(r.steps) ? r.steps : [], totals: r.totals ?? {}, holdout: r.holdout ?? null, daily: Array.isArray(r.daily) ? r.daily : undefined };
    },
  );
};
