"use client";

import { useState, useTransition, type FC, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createCampaign, scheduleCampaign, updateCampaign } from "@/libs/mail-admin";
import {
  EMPTY_CONTENT,
  PREF_LABELS,
  SENDER_LABELS,
  type AbTestInput,
  type CampaignInput,
  type MailAudience,
  type MailCampaign,
  type MailOffer,
  type MailTemplate,
  type MarketingPref,
  type OfferChoice,
  type TemplateContent,
} from "@/app/lib/mail/types";
import ContentFields from "@/app/components/mail/ContentFields";
import MailPreview from "@/app/components/mail/MailPreview";
import OfferPicker from "@/app/components/mail/OfferPicker";
import { useAudienceCount } from "@/app/components/mail/useAudienceCount";
import { BTN, BTN_PRIMARY, ErrorBox, Field, INPUT, INPUT_SM, Segmented } from "@/app/components/mail/ui";
import { filterSummary, fromLocalInput, n, numOrUndef, offerChoiceProblem, toLocalInput } from "@/app/components/mail/format";

/** Over this many people, sending asks for the count to be typed. */
const CONFIRM_OVER = 500;

const contentOf = (t: MailTemplate): TemplateContent => ({
  subject: t.subject,
  preview: t.preview,
  blocks: t.blocks ?? [],
  sender: t.sender,
  pref: t.pref,
  feedbackFooter: Boolean(t.feedbackFooter),
});

const DEFAULT_AB: AbTestInput = { subjectB: "", testPercent: 10, decideAfterHours: 4, mode: "auto" };

type Props = {
  campaign: MailCampaign | null;
  templates: MailTemplate[];
  audiences: MailAudience[];
  offers: MailOffer[];
  maxDiscountPercent: number;
};

/**
 * A draft campaign: content (a template, or a one-off mail), audience with its live count, pref,
 * an optional offer, an optional subject A/B, then schedule or send now. Sending to more than 500
 * people asks for the count to be typed, and the backend checks it against its own live count.
 */
const CampaignEditor: FC<Props> = ({ campaign, templates, audiences, offers, maxDiscountPercent }) => {
  const router = useRouter();
  const initialTemplate = campaign?.templateId ? templates.find((t) => t.id === campaign.templateId) : undefined;

  const [savedId, setSavedId] = useState<string | null>(campaign?.id ?? null);
  const [name, setName] = useState(campaign?.name ?? "");
  const [mode, setMode] = useState<"template" | "oneoff">(campaign && !campaign.templateId ? "oneoff" : "template");
  const [templateId, setTemplateId] = useState(campaign?.templateId ?? "");
  const [content, setContent] = useState<TemplateContent>(() => {
    // A template's current content, with the pref the campaign chose.
    if (initialTemplate) return { ...contentOf(initialTemplate), pref: campaign?.content?.pref ?? initialTemplate.pref ?? "emailProductNews" };
    return campaign?.content ?? { ...EMPTY_CONTENT };
  });
  const [audienceId, setAudienceId] = useState(campaign?.audienceId ?? "");
  const [offer, setOffer] = useState<OfferChoice | null>(campaign?.offer ?? null);
  const [ab, setAb] = useState<AbTestInput | null>(
    campaign?.abTest ? { subjectB: campaign.abTest.subjectB, testPercent: campaign.abTest.testPercent, decideAfterHours: campaign.abTest.decideAfterHours, mode: campaign.abTest.mode } : null,
  );
  const [when, setWhen] = useState<"now" | "later">(campaign?.sendAt ? "later" : "now");
  const [sendAt, setSendAt] = useState(toLocalInput(campaign?.sendAt ?? null));
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const audience = audiences.find((a) => a.id === audienceId) ?? null;
  const live = useAudienceCount(audience?.filter ?? null);
  const count = live.data?.count ?? null;
  const needsTyped = count !== null && count > CONFIRM_OVER;
  const usableTemplates = templates.filter((t) => !t.archived || t.id === templateId);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setContent((c) => ({ ...contentOf(t), pref: t.pref ?? c.pref ?? "emailProductNews" }));
  };

  const input = (): CampaignInput => ({
    name: name.trim(),
    templateId: mode === "template" ? templateId || null : null,
    content,
    audienceId: audienceId || null,
    offer,
    abTest: ab,
  });

  const draftProblem = (): string | null => {
    if (!name.trim()) return "Give the campaign a name.";
    if (mode === "template" && !templateId) return "Pick a template, or write a one-off mail.";
    const offerIssue = offerChoiceProblem(offer, offers, maxDiscountPercent);
    if (offerIssue) return offerIssue;
    if (ab) {
      if (!ab.subjectB.trim()) return "Write subject B, or switch the test off.";
      if (!(ab.testPercent >= 1 && ab.testPercent <= 50)) return "Each test side is 1 to 50% of the audience.";
      if (!(ab.decideAfterHours >= 1)) return "Decide after at least 1 hour.";
    }
    return null;
  };

  const sendProblem = (): string | null => {
    const issue = draftProblem();
    if (issue) return issue;
    if (!content.subject.trim()) return "The mail needs a subject.";
    if (!content.blocks.length) return "The mail needs at least one block.";
    if (!content.pref) return "Pick who can get it (the pref).";
    if (!audienceId) return "Pick an audience.";
    if (count === 0) return "Nobody in this audience can get mail now.";
    if (when === "later") {
      const at = fromLocalInput(sendAt);
      if (!at) return "Pick when to send.";
      if (new Date(at).getTime() < Date.now() - 60_000) return "That time has passed.";
    }
    if (needsTyped && Number(typed.replace(/[^\d]/g, "")) !== count) return `Type ${n(count)} to confirm the number of people.`;
    return null;
  };

  /** Creates or updates the draft; answers its id, or null with the error shown. */
  const saveDraft = async (): Promise<string | null> => {
    const res = savedId ? await updateCampaign(savedId, input()) : await createCampaign(input());
    if (res.error || !res.data) {
      setError(res.error ?? "Not saved.");
      return null;
    }
    if (!savedId) setSavedId(res.data.id);
    return res.data.id;
  };

  const onSaveDraft = () => {
    const issue = draftProblem();
    if (issue) {
      setError(issue);
      return;
    }
    start(async () => {
      setError(null);
      setNote(null);
      const wasNew = !savedId;
      const id = await saveDraft();
      if (!id) return;
      setNote("Draft saved.");
      if (wasNew) router.replace(`/heroshima/outreach/campaigns/${id}`);
    });
  };

  const onSend = () => {
    const issue = sendProblem();
    if (issue) {
      setError(issue);
      setConfirming(false);
      return;
    }
    start(async () => {
      setError(null);
      setNote(null);
      const wasNew = !savedId;
      const id = await saveDraft();
      if (!id) return;
      const res = await scheduleCampaign(id, {
        sendAt: when === "later" ? fromLocalInput(sendAt) : null,
        confirmCount: needsTyped ? (count ?? undefined) : undefined,
      });
      setConfirming(false);
      if (res.error) {
        setError(res.error);
        if (wasNew) router.replace(`/heroshima/outreach/campaigns/${id}`);
        return;
      }
      router.push(`/heroshima/outreach/campaigns/${id}`);
      router.refresh();
    });
  };

  const sendLabel = when === "now" ? `Send now${count !== null ? ` to ${n(count)} people` : ""}` : "Schedule";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,720px)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Step title="Name">
          <Field label="Only admins see it">
            <input className={INPUT} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="November product news" />
          </Field>
        </Step>

        <Step title="1. Content">
          <Segmented
            label="Content"
            value={mode}
            onChange={setMode}
            options={[
              { value: "template", label: "Use a template" },
              { value: "oneoff", label: "Write a one-off" },
            ]}
          />
          {mode === "template" ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Template" className={`${INPUT} max-w-md`} value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                  <option value="">Pick a template</option>
                  {usableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {templateId ? (
                  <Link href={`/heroshima/outreach/templates/${templateId}`} target="_blank" className="text-xs font-semibold hover:underline">
                    Edit template
                  </Link>
                ) : (
                  <Link href="/heroshima/outreach/templates/new" target="_blank" className="text-xs font-semibold hover:underline">
                    New template
                  </Link>
                )}
              </div>
              {templateId ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <p className="text-sm md:col-span-2">
                    <span className="text-gray-500">Subject</span> <strong>{content.subject}</strong>
                    <span className="text-gray-500"> · from {SENDER_LABELS[content.sender]}</span>
                  </p>
                  <Field label="Who can get it" hint="Only people with this mail switch on.">
                    <select className={INPUT} value={content.pref ?? "emailProductNews"} onChange={(e) => setContent({ ...content, pref: e.target.value as MarketingPref })}>
                      {(Object.keys(PREF_LABELS) as MarketingPref[]).map((p) => (
                        <option key={p} value={p}>
                          {PREF_LABELS[p]} on
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3">
              <ContentFields content={content} onChange={setContent} prefRequired />
            </div>
          )}
        </Step>

        <Step title="2. Audience">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Audience" className={`${INPUT} max-w-md`} value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
              <option value="">Pick an audience</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Link href="/heroshima/outreach/audience/new" target="_blank" className="text-xs font-semibold hover:underline">
              New audience
            </Link>
          </div>
          {audience ? (
            <div className="mt-2 text-sm">
              <p className="text-gray-600">{filterSummary(audience.filter)}</p>
              <p className="mt-1">
                {live.loading ? (
                  <LoaderCircle className="inline h-4 w-4 animate-spin text-gray-500" aria-label="Counting" />
                ) : live.error ? (
                  <span className="text-[#b23c26]">{live.error}</span>
                ) : (
                  <>
                    <strong className="tabular-nums">{count !== null ? n(count) : "..."}</strong> people can get it now
                    {content.pref ? ` (before the ${PREF_LABELS[content.pref]} switch, caps and quiet hours)` : ""}.
                  </>
                )}
              </p>
            </div>
          ) : null}
        </Step>

        <Step title="3. Offer (optional)">
          <OfferPicker offers={offers} value={offer} onChange={setOffer} maxDiscountPercent={maxDiscountPercent} />
        </Step>

        <Step title="4. Subject test (optional)">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={Boolean(ab)} onChange={(e) => setAb(e.target.checked ? { ...DEFAULT_AB } : null)} /> Test a second subject
          </label>
          {ab ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Subject A">
                <input className={INPUT} value={content.subject} readOnly={mode === "template"} onChange={(e) => setContent({ ...content, subject: e.target.value })} />
              </Field>
              <Field label="Subject B">
                <input className={INPUT} value={ab.subjectB} maxLength={200} onChange={(e) => setAb({ ...ab, subjectB: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-1.5 text-sm md:col-span-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  aria-label="Percent per side"
                  className={`${INPUT_SM} w-16 tabular-nums`}
                  value={ab.testPercent}
                  onChange={(e) => setAb({ ...ab, testPercent: numOrUndef(e.target.value) ?? 0 })}
                />
                % get A and as many get B; after
                <input
                  type="number"
                  min={1}
                  aria-label="Decide after hours"
                  className={`${INPUT_SM} w-16 tabular-nums`}
                  value={ab.decideAfterHours}
                  onChange={(e) => setAb({ ...ab, decideAfterHours: numOrUndef(e.target.value) ?? 0 })}
                />
                hours the rest get
                <select aria-label="Winner" className={INPUT_SM} value={ab.mode} onChange={(e) => setAb({ ...ab, mode: e.target.value as AbTestInput["mode"] })}>
                  <option value="auto">the subject with more unique clicks</option>
                  <option value="manual">the subject I pick</option>
                </select>
              </div>
            </div>
          ) : null}
        </Step>

        <Step title="5. Send">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                label="When"
                value={when}
                onChange={(w) => {
                  setWhen(w);
                  setConfirming(false);
                }}
                options={[
                  { value: "now", label: "Now" },
                  { value: "later", label: "Later" },
                ]}
              />
              {when === "later" ? (
                <input type="datetime-local" aria-label="Send at" className={`${INPUT_SM}`} value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
              ) : null}
            </div>
            <p className="text-xs text-gray-500">Caps (per person, per day and week) and quiet hours apply. People over the cap are skipped and counted.</p>
            {needsTyped ? (
              <Field label={`To send to ${n(count)} people, type the number`}>
                <input inputMode="numeric" className={`${INPUT} max-w-[200px] tabular-nums`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={String(count)} />
              </Field>
            ) : null}

            {error ? <ErrorBox>{error}</ErrorBox> : null}

            <div className="flex flex-wrap items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-sm font-semibold">
                    {when === "now" ? `Send to ${count !== null ? n(count) : "everyone in the audience"} now?` : `Schedule for ${new Date(sendAt).toLocaleString("en-GB")}?`}
                  </span>
                  <button type="button" onClick={onSend} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-bold text-[#e1f073] br-bold-press br-lime disabled:opacity-60">
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Yes, {when === "now" ? "send" : "schedule"}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="px-2 text-xs font-semibold text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const issue = sendProblem();
                    setError(issue);
                    if (!issue) setConfirming(true);
                  }}
                  className={BTN_PRIMARY}>
                  {sendLabel}
                </button>
              )}
              <button type="button" onClick={onSaveDraft} disabled={busy} className={BTN}>
                {busy && !confirming ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Save draft
              </button>
              {note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
            </div>
          </div>
        </Step>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <MailPreview content={content} />
      </div>
    </div>
  );
};

const Step: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section className="rounded-md border border-gray-300 bg-white p-4">
    <h2 className="mb-3 text-sm font-bold">{title}</h2>
    {children}
  </section>
);

export default CampaignEditor;
