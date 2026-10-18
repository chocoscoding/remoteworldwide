"use client";

import { useMemo, type FC } from "react";
import { LabeledSelect, type LabeledSelectOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { FONT_OPTIONS } from "@/app/lib/dashboard/resume/fonts";
import type { FontId } from "@/app/lib/dashboard/resume/design-types";

/** `className` mirrors `previewClass` so each dropdown row renders in its own face. */
const FONT_SELECT_OPTIONS: LabeledSelectOption<FontId>[] = FONT_OPTIONS.map((font) => ({
  id: font.id,
  label: font.label,
  className: font.previewClass,
}));

const FontPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { body, name } = design.font;

  // Two long menus, each row in its own face: rebuilt only when a font changes, not on every
  // slider step elsewhere in Customize (owner, 2026-10-17: the preview should follow a drag faster).
  return useMemo(() => (
    <div className="flex flex-col gap-5">
      <LabeledSelect
        label="Body Font"
        orientation="stacked"
        options={FONT_SELECT_OPTIONS}
        value={body}
        onChange={(id) => dispatch({ type: "font/set", slot: "body", id })}
      />
      <LabeledSelect
        label="Name Font"
        orientation="stacked"
        options={FONT_SELECT_OPTIONS}
        value={name}
        onChange={(id) => dispatch({ type: "font/set", slot: "name", id })}
      />
    </div>
  ), [body, name, dispatch]);
};

export default FontPanel;
