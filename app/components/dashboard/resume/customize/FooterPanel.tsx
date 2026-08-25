"use client";

import { useState, type FC } from "react";
import { ToggleRow } from "../controls";
import { useResumeDesign } from "../useResumeDesign";

/**
 * `footer/setText` has no `transient` variant (unlike the sliders), so
 * dispatching it on every keystroke would push one undo entry per character
 * — the same problem `ColorWheelPopover`'s hex field solves by debouncing at
 * the COMPONENT level rather than the reducer (see design-reducer.ts's
 * header comment). A plain `<input>` has no built-in "settled" event either,
 * so this commits on blur / Enter instead.
 *
 * `draft` is resynced from `footer.text` DURING RENDER (not inside an
 * effect) whenever it changes from outside this input — e.g. undo/redo —
 * using React's documented "adjusting state when a prop changes" pattern: a
 * conditional `setState` call in the render body itself. This is not
 * `setState` inside an effect body, so `react-hooks/set-state-in-effect`
 * does not apply.
 */
const FooterPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { footer } = design;
  const disabled = !footer.show;

  const [syncedText, setSyncedText] = useState(footer.text);
  const [draft, setDraft] = useState(footer.text);
  if (footer.text !== syncedText) {
    setSyncedText(footer.text);
    setDraft(footer.text);
  }

  const commit = () => {
    if (draft !== footer.text) dispatch({ type: "footer/setText", text: draft });
  };

  return (
    <div className="flex flex-col gap-5">
      <ToggleRow label="Show Footer" checked={footer.show} onCheckedChange={() => dispatch({ type: "footer/toggle" })} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-black/55">Footer Text</span>
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder="e.g. References available on request"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            commit();
          }}
          className="w-full rounded-xl border border-black/12 bg-[#fbfbf7] px-3.5 py-2.5 text-sm text-primary placeholder:text-black/35 outline-none transition-colors focus:border-black/25 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <ToggleRow
        label="Page Numbers"
        checked={footer.showPageNumbers}
        disabled={disabled}
        onCheckedChange={() => dispatch({ type: "footer/togglePageNumbers" })}
      />
    </div>
  );
};

export default FooterPanel;
