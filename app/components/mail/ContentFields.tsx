"use client";

import type { FC } from "react";
import { MARKETING_PREFS, PREF_LABELS, SENDER_LABELS, type MailSender, type MarketingPref, type TemplateContent } from "@/app/lib/mail/types";
import BlockEditor from "./BlockEditor";
import TextField from "./content/TextField";
import { Field, INPUT } from "./ui";

/**
 * One mail's settings: subject, preview line, sender, who can get it and the feedback footer. The
 * content editor shows them under "Mail settings" when no block is picked. With `blocks`, the plain
 * block list follows (the form used when the preview can't be drawn).
 */
const ContentFields: FC<{ content: TemplateContent; onChange: (content: TemplateContent) => void; prefRequired?: boolean; blocks?: boolean }> = ({
  content,
  onChange,
  prefRequired,
  blocks,
}) => {
  const set = <K extends keyof TemplateContent>(key: K, value: TemplateContent[K]) => onChange({ ...content, [key]: value });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <TextField label="Subject" value={content.subject} maxLength={200} onChange={(v) => set("subject", v)} placeholder="Still choosing a plan, {{firstName|there}}?" />
        <TextField label="Preview line" value={content.preview} maxLength={200} onChange={(v) => set("preview", v)} hint="The grey text after the subject in the inbox." />
        <Field label="From">
          <select className={INPUT} value={content.sender} onChange={(e) => set("sender", e.target.value as MailSender)}>
            {(Object.keys(SENDER_LABELS) as MailSender[]).map((s) => (
              <option key={s} value={s}>
                {SENDER_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who can get it" hint="Only people with this mail switched on. It names the unsubscribe link.">
          <select className={INPUT} value={content.pref ?? ""} onChange={(e) => set("pref", (e.target.value || null) as MarketingPref | null)}>
            {!prefRequired ? <option value="">No pref (not for marketing)</option> : null}
            {MARKETING_PREFS.map((p) => (
              <option key={p} value={p}>
                {PREF_LABELS[p]} on
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={content.feedbackFooter} onChange={(e) => set("feedbackFooter", e.target.checked)} /> &quot;Was this useful? Yes / No&quot; at the foot
        </label>
      </div>
      {blocks ? (
        <div>
          <p className="mb-2 text-sm font-bold">Blocks</p>
          <BlockEditor blocks={content.blocks} onChange={(b) => set("blocks", b)} />
        </div>
      ) : null}
    </div>
  );
};

export default ContentFields;
