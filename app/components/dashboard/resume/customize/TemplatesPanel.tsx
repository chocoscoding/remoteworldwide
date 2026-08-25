"use client";

import { useState, type FC } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeDesign } from "../useResumeDesign";
import { TEMPLATE_OPTIONS } from "@/app/lib/dashboard/resume/templates";
import { DEFAULT_DESIGN } from "@/app/lib/dashboard/resume/design-defaults";
import type { ResumeTemplateId } from "@/app/lib/dashboard/resume/design-types";

/**
 * The real 6-template gallery (Phase B chunk 2). Each row is a live button:
 * clicking dispatches `template/apply`, which replaces `design`/`sections`
 * wholesale as ONE undo-history entry (see `design-reducer.ts`'s comment
 * above `snapshotReducer`'s `"template/apply"` case) — so an accidental
 * click is one Undo away from being fully reverted, and no confirmation
 * dialog is warranted.
 *
 * `lastAppliedId` is deliberately NOT a read of live design state — the
 * architecture never lets applied-template identity leak back into
 * `ResumeDesign` (that's the fix for the old screen's `classic`-template
 * permanently overriding the Font control; see `lookupTemplate`'s comment
 * in `design-reducer.ts`). So there is nothing to select a highlighted card
 * from once the user has touched Colors, Font, etc. — even a deep-equality
 * check against every template's merged design would be misleading more
 * often than not. This state is honestly just "the last card clicked in
 * this panel session," seeded to "atlas" because a fresh document's design
 * is exactly `DEFAULT_DESIGN`/`DEFAULT_SECTIONS` (`initHistory()`) and
 * Atlas's own diff is `{}` — so on a fresh document that really is the
 * active template.
 */
const TemplatesPanel: FC = () => {
  const { dispatch } = useResumeDesign();
  const [lastAppliedId, setLastAppliedId] = useState<ResumeTemplateId>("atlas");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {TEMPLATE_OPTIONS.map((tpl) => {
          const selected = tpl.id === lastAppliedId;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                dispatch({ type: "template/apply", id: tpl.id });
                setLastAppliedId(tpl.id);
              }}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition-all cursor-pointer",
                selected
                  ? "border-2 border-[#222325] shadow-[3px_3px_0_0_#e1f073]"
                  : "border-black/10 hover:border-black/25"
              )}>
              {selected && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-content-center rounded-full bg-[#222325] text-[#e1f073]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}

              <tpl.Thumb accent={tpl.design.colors?.accent ?? DEFAULT_DESIGN.colors.accent} />

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-primary">{tpl.name}</p>
                <p className="text-[11px] text-black/45">{tpl.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-black/45">
        Applying a template is one undo away if you change your mind.
      </p>
    </div>
  );
};

export default TemplatesPanel;
