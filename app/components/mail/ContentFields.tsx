"use client";

import type { FC } from "react";
import { MARKETING_PREFS, PREF_LABELS, SENDER_LABELS, type MailSender, type MarketingPref, type TemplateContent } from "@/app/lib/mail/types";
import BlockEditor from "./BlockEditor";
import { Field, INPUT } from "./ui";

/** Subject, preview line, sender, pref, feedback footer and blocks: one mail's content. */
const ContentFields: FC<{ content: TemplateContent; onChange: (content: TemplateContent) => void; prefRequired?: boolean }> = ({ content, onChange, prefRequired }) => {
  const set = <K extends keyof TemplateContent>(key: K, value: TemplateContent[K]) => onChange({ ...content, [key]: value });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Subject" className="md:col-span-2">
          <input className={INPUT} value={content.subject} maxLength={200} onChange={(e) => set("subject", e.target.value)} placeholder="Still choosing a plan, {{firstName|there}}?" required />
        </Field>
        <Field label="Preview line" hint="The grey text after the subject in the inbox." className="md:col-span-2">
          <input className={INPUT} value={content.preview} maxLength={200} onChange={(e) => set("preview", e.target.value)} />
        </Field>
        <Field label="From">
          <select className={INPUT} value={content.sender} onChange={(e) => set("sender", e.target.value as MailSender)}>
            {(Object.keys(SENDER_LABELS) as MailSender[]).map((s) => (
              <option key={s} value={s}>
                {SENDER_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who can get it" hint="Only people with this mail switch on. It names the unsubscribe link.">
          <select className={INPUT} value={content.pref ?? ""} onChange={(e) => set("pref", (e.target.value || null) as MarketingPref | null)}>
            {!prefRequired ? <option value="">No pref (not for marketing)</option> : null}
            {MARKETING_PREFS.map((p) => (
              <option key={p} value={p}>
                {PREF_LABELS[p]} on
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
          <input type="checkbox" checked={content.feedbackFooter} onChange={(e) => set("feedbackFooter", e.target.checked)} /> &quot;Was this useful? Yes / No&quot; at the foot
        </label>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">Blocks</p>
        <BlockEditor blocks={content.blocks} onChange={(blocks) => set("blocks", blocks)} />
      </div>
    </div>
  );
};

export default ContentFields;
