"use client";

import type { FC } from "react";
import { SegmentedControl, ThumbnailPicker, type SegmentedControlOption, type ThumbnailOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { ICON_SETS, ICON_SET_OPTIONS } from "@/app/lib/dashboard/resume/icon-sets";
import type { HeaderArrange, IconSetId, SeparatorMode, TextAlign } from "@/app/lib/dashboard/resume/design-types";

const ALIGN_OPTIONS: SegmentedControlOption<TextAlign>[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
];

const ARRANGE_OPTIONS: SegmentedControlOption<HeaderArrange>[] = [
  { id: "stack", label: "Stack" },
  { id: "inline", label: "Inline" },
  { id: "split", label: "Split" },
];

const SEPARATOR_OPTIONS: SegmentedControlOption<SeparatorMode>[] = [
  { id: "icon", label: "Icon" },
  { id: "bullet", label: "Bullet" },
  { id: "bar", label: "Bar" },
];

/** Each icon set is differentiated by its "mail" glyph — see icon-sets.ts. */
const ICON_STYLE_OPTIONS: ThumbnailOption<IconSetId>[] = ICON_SET_OPTIONS.map((opt) => {
  const Glyph = ICON_SETS[opt.id].mail;
  return {
    id: opt.id,
    label: opt.label,
    preview: (
      <div className="flex h-12 w-full items-center justify-center">
        <Glyph className="h-5 w-5 text-black/70" />
      </div>
    ),
  };
});

const HeaderPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { header } = design;

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Text Alignment"
        options={ALIGN_OPTIONS}
        value={header.align}
        onChange={(align) => dispatch({ type: "header/setAlign", align })}
      />
      <SegmentedControl
        label="Details Arrangement"
        options={ARRANGE_OPTIONS}
        value={header.arrange}
        onChange={(arrange) => dispatch({ type: "header/setArrange", arrange })}
      />
      <SegmentedControl
        label="Separator"
        options={SEPARATOR_OPTIONS}
        value={header.separator}
        onChange={(separator) => dispatch({ type: "header/setSeparator", separator })}
      />
      <ThumbnailPicker
        label="Icon Style"
        columns={2}
        options={ICON_STYLE_OPTIONS}
        value={header.iconSet}
        onChange={(id) => dispatch({ type: "header/setIconSet", id })}
      />
    </div>
  );
};

export default HeaderPanel;
