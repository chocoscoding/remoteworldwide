"use client";

import { useState, useTransition, type FC, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle } from "lucide-react";
import { createCampaign, scheduleCampaign, updateCampaign } from "@/libs/mail-admin";
import {
  EMPTY_CONTENT,
  PREF_LABELS,
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
import MailEditor from "@/app/components/mail/content/MailEditor";
import { pickContent } from "@/app/components/mail/content/blocks";
import { offerSampleOf } from "@/app/components/mail/content/offerPreview";
import OfferPicker from "@/app/components/mail/OfferPicker";
import { useAudienceCount } from "@/app/components/mail/useAudienceCount";
import { BTN, BTN_LINK, BTN_PRIMARY, ErrorBox, INPUT, INPUT_SM, Switch } from "@/app/components/mail/ui";
import { fromLocalInput, leftOutLines, n, numOrUndef, offerChoiceProblem, toLocalInput } from "@/app/components/mail/format";
import { cn } from "@/lib/utils";

/** Over this many people, sending asks for the count to be typed. */
const CONFIRM_OVER = 500;
/** Picker values that aren't ids: write a one-off here, or make a new one in another tab. */
const ONE_OFF = "__one-off";
const NEW_ONE = "__new";

/** A template's mail, field by field (its design included). */
const contentOf = (t: MailTemplate): TemplateContent => pickContent(t);

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
    // A template's current content, with the "Only if" the campaign chose. Nothing is picked until the
    // admin picks it: none = anyone with a marketing email on.
    const own = campaign?.content ? (campaign.content.pref ?? null) : null;
    if (initialTemplate) return { ...contentOf(initialTemplate), pref: own };
    return campaign?.content ? pickContent(campaign.content) : { ...EMPTY_CONTENT, pref: null };
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
  const [showMail, setShowMail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const audience = audiences.find((a) => a.id === audienceId) ?? null;
  // Counted with the "Only if" the send will apply, so the number is who it actually reaches.
  const live = useAudienceCount(audience?.filter ?? null, content.pref ?? null);
  const count = live.data?.count ?? null;
  // How many accounts the audience matches, and why the ones outside `count` can't get it.
  const total = live.data?.total ?? null;
  const leftOut = leftOutLines(live.data?.leftOut, content.pref ?? null);
  const needsTyped = count !== null && count > CONFIRM_OVER;
  const usableTemplates = templates.filter((t) => !t.archived || t.id === templateId);

  /** The Mail picker: a saved mail, a one-off written here, or a new saved mail made in another tab. */
  const chooseMail = (value: string) => {
    if (value === NEW_ONE) {
      window.open("/heroshima/outreach/templates/new", "_blank", "noopener");
      return;
    }
    if (value === ONE_OFF) {
      setMode("oneoff");
      return;
    }
    setMode("template");
    pickTemplate(value);
  };

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    // The campaign keeps its own "Only if" (picking a mail never sets one).
    if (t) setContent((c) => ({ ...contentOf(t), pref: c.pref ?? null }));
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
    if (mode === "template" && !templateId) return "Pick a saved mail, or write a one-off.";
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

  const sendLabel = when === "now" ? `Send now${count !== null ? ` to ${n(count)} ${count === 1 ? "person" : "people"}` : ""}` : "Schedule";

  const templateName = templates.find((t) => t.id === templateId)?.name ?? "this mail";
  const hasOfferBlock = content.blocks.some((b) => b.type === "offer");
  const offerPicker = <OfferPicker offers={offers} value={offer} onChange={setOffer} maxDiscountPercent={maxDiscountPercent} />;
  // The chosen offer with its overrides: the mail's preview and test draw the offer box from it.
  const chosenOffer = offer ? offers.find((o) => o.id === offer.offerId) : undefined;
  const offerPreview = chosenOffer && offer ? { name: chosenOffer.name, sample: offerSampleOf(chosenOffer, offer) } : undefined;
  const hasMail = mode === "oneoff" || Boolean(templateId);
  // A one-off is written here, so its editor is always open; a saved mail is only previewed, on request.
  const mailOpen = mode === "oneoff" || showMail;
  // null: no "Only if", so anyone with at least one marketing email on.
  const pref = content.pref ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="sr-only">{name.trim() || "New campaign"}</h1>
        <input
          aria-label="Campaign name"
          value={name}
          maxLength={120}
          placeholder="Untitled campaign"
          onChange={(e) => setName(e.target.value)}
          className="-mx-1.5 w-full max-w-2xl rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-bold placeholder:text-gray-400 hover:border-gray-300 focus:border-black focus:outline-none"
        />
      </header>

      <section aria-label="Campaign" className="rounded-md border border-gray-300 bg-white">
        <div className="divide-y divide-gray-200 px-4">
          <Row label="Mail">
            <select aria-label="Mail" className={cn(INPUT_SM, "w-full max-w-sm")} value={mode === "oneoff" ? ONE_OFF : templateId} onChange={(e) => chooseMail(e.target.value)}>
              <option value="">Pick a mail</option>
              {usableTemplates.length ? (
                <optgroup label="Saved mails">
                  {usableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="Or">
                <option value={ONE_OFF}>Write a one-off for this campaign</option>
                <option value={NEW_ONE}>+ New saved mail (opens a tab)</option>
              </optgroup>
            </select>
            {hasMail && content.subject ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                <span className="truncate">
                  Subject: <span className="font-semibold text-black">{content.subject}</span>
                </span>
                {mode === "template" ? (
                  <>
                    <button type="button" onClick={() => setShowMail((v) => !v)} className={BTN_LINK}>
                      {showMail ? "Hide the mail" : "Show the mail"}
                    </button>
                    <Link href={`/heroshima/outreach/templates/${templateId}`} target="_blank" className={BTN_LINK}>
                      Edit it
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </Row>

          <Row label="Goes to">
            <select
              aria-label="Audience"
              className={cn(INPUT_SM, "w-full max-w-sm")}
              value={audienceId}
              onChange={(e) => {
                if (e.target.value === NEW_ONE) window.open("/heroshima/outreach/audience/new", "_blank", "noopener");
                else setAudienceId(e.target.value);
              }}>
              <option value="">Pick an audience</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value={NEW_ONE}>+ New audience (opens a tab)</option>
            </select>
            {audience ? (
              <p className="mt-1.5 text-xs text-gray-600">
                {live.loading ? (
                  <LoaderCircle className="inline h-3.5 w-3.5 animate-spin text-gray-500" aria-label="Counting" />
                ) : live.error ? (
                  <span className="text-[#b23c26]">{live.error}</span>
                ) : (
                  <>
                    <strong className="tabular-nums text-black">{count !== null ? n(count) : "..."}</strong>
                    {total !== null && count !== null && total !== count ? <span className="tabular-nums"> of {n(total)}</span> : null} can get it
                    {/* Why the rest can't: on hover, and in full when nobody can. */}
                    {leftOut.length && count !== 0 ? (
                      <span title={leftOut.join("\n")} className="ml-1 inline-flex cursor-help align-[-2px] text-gray-400 hover:text-black">
                        <Info className="h-3.5 w-3.5" aria-label={leftOut.join(". ")} />
                      </span>
                    ) : null}
                    {leftOut.length && count === 0 ? <span className="mt-0.5 block text-gray-500">{leftOut.join(" · ")}</span> : null}
                  </>
                )}
              </p>
            ) : null}
          </Row>

          <Row label="Only if">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(PREF_LABELS) as MarketingPref[]).map((p) => (
                <Choice key={p} toggle on={pref === p} onClick={() => setContent({ ...content, pref: pref === p ? null : p })}>
                  {PREF_LABELS[p]} emails on
                </Choice>
              ))}
              {pref ? null : <span className="text-xs text-gray-400">Optional</span>}
            </div>
          </Row>

          <Row label="Offer">
            {offerPicker}
            {offer && !hasOfferBlock ? (
              <p className="mt-1.5 text-xs text-gray-500">The mail has no offer box, so add one or link a button to {"{{offerUrl}}"}.</p>
            ) : !offer && hasOfferBlock ? (
              <p className="mt-1.5 text-xs text-gray-500">The mail&apos;s offer box is left out without an offer.</p>
            ) : null}
          </Row>

          <Row label="Subject test">
            <Switch checked={Boolean(ab)} onChange={(on) => setAb(on ? { ...DEFAULT_AB } : null)} label="Test a second subject" />
            {ab ? (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  aria-label="Subject B"
                  className={cn(INPUT, "max-w-xl")}
                  value={ab.subjectB}
                  maxLength={200}
                  placeholder="Subject B"
                  onChange={(e) => setAb({ ...ab, subjectB: e.target.value })}
                />
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    aria-label="Percent per side"
                    className={cn(INPUT_SM, "w-16 tabular-nums")}
                    value={ab.testPercent}
                    onChange={(e) => setAb({ ...ab, testPercent: numOrUndef(e.target.value) ?? 0 })}
                  />
                  % get each subject, then after
                  <input
                    type="number"
                    min={1}
                    aria-label="Decide after hours"
                    className={cn(INPUT_SM, "w-16 tabular-nums")}
                    value={ab.decideAfterHours}
                    onChange={(e) => setAb({ ...ab, decideAfterHours: numOrUndef(e.target.value) ?? 0 })}
                  />
                  h the rest get
                  <select aria-label="Winner" className={INPUT_SM} value={ab.mode} onChange={(e) => setAb({ ...ab, mode: e.target.value as AbTestInput["mode"] })}>
                    <option value="auto">the one with more clicks</option>
                    <option value="manual">the one I pick</option>
                  </select>
                </p>
              </div>
            ) : null}
          </Row>

          <Row label="When">
            <div className="flex flex-wrap items-center gap-2">
              <Choice
                on={when === "now"}
                onClick={() => {
                  setWhen("now");
                  setConfirming(false);
                }}>
                Now
              </Choice>
              <Choice
                on={when === "later"}
                onClick={() => {
                  setWhen("later");
                  setConfirming(false);
                }}>
                Later
              </Choice>
              {when === "later" ? <input type="datetime-local" aria-label="Send at" className={INPUT_SM} value={sendAt} onChange={(e) => setSendAt(e.target.value)} /> : null}
            </div>
          </Row>
        </div>
      </section>

      {hasMail && mailOpen ? (
        <section aria-label="The mail" className="min-w-0">
          <MailEditor
            content={content}
            onChange={setContent}
            campaign
            offer={{ picker: offerPicker, href: offer ? `/heroshima/outreach/offers/${offer.offerId}` : undefined, preview: offerPreview }}
            locked={
              mode === "template" ? (
                <div className="flex flex-col gap-3 text-sm text-gray-700">
                  <p>
                    <strong>{templateName}</strong> goes out as it is when you send.
                  </p>
                  <button type="button" onClick={() => setMode("oneoff")} className={cn(BTN_LINK, "self-start")}>
                    Change it for this campaign only
                  </button>
                </div>
              ) : undefined
            }
          />
        </section>
      ) : null}

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-gray-300 bg-white/95 py-3">
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {needsTyped && !confirming ? (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Type {n(count)} to send to that many people
            <input inputMode="numeric" aria-label="Number of people" className={cn(INPUT_SM, "w-28 tabular-nums")} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={String(count)} />
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSaveDraft} disabled={busy} className={BTN}>
            {busy && !confirming ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Save draft
          </button>
          {note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <span title="Daily and weekly limits per person and quiet hours apply; people over a limit are skipped and counted." className="text-gray-400">
              <Info className="h-4 w-4" aria-label="Limits and quiet hours apply" />
            </span>
            {confirming ? (
              <>
                <span className="text-sm font-semibold">
                  {when === "now" ? `Send to ${count !== null ? n(count) : "everyone in the audience"} now?` : `Schedule for ${new Date(sendAt).toLocaleString("en-GB")}?`}
                </span>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={BTN_LINK}>
                  Cancel
                </button>
                <button type="button" onClick={onSend} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-bold text-[#e1f073] br-bold-press br-lime disabled:opacity-60">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Yes, {when === "now" ? "send" : "schedule"}
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
          </span>
        </div>
      </div>
    </div>
  );
};

/** A label column and its control, one compact row. */
const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="grid gap-1.5 py-3 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-start sm:gap-3">
    <p className="text-xs font-semibold text-gray-600 sm:pt-1.5">{label}</p>
    <div className="min-w-0">{children}</div>
  </div>
);

/** One of a few choices, as a chip. */
/** A chip. `toggle`: optional, so pressing the chosen one again clears it (a pressed button, not a radio). */
const Choice: FC<{ on: boolean; onClick: () => void; toggle?: boolean; children: ReactNode }> = ({ on, onClick, toggle, children }) => (
  <button
    type="button"
    role={toggle ? undefined : "radio"}
    aria-checked={toggle ? undefined : on}
    aria-pressed={toggle ? on : undefined}
    onClick={onClick}
    className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black")}>
    {children}
  </button>
);

export default CampaignEditor;
