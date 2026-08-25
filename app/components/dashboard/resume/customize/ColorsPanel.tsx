"use client";

import type { FC } from "react";
import { ColorWheelPopover, SegmentedControl, SwatchGrid, ToggleRow, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import { ACCENT_SWATCH_HEXES, ACCENT_TARGETS } from "@/app/lib/dashboard/resume/palette";
import type { ColorArea, ColorMode } from "@/app/lib/dashboard/resume/design-types";

const AREA_OPTIONS: SegmentedControlOption<ColorArea>[] = [
  { id: "full", label: "Full Page" },
  { id: "header", label: "Header" },
  { id: "border", label: "Border" },
];

const MODE_OPTIONS: SegmentedControlOption<ColorMode>[] = [
  { id: "single", label: "Single" },
  { id: "multi", label: "Multi" },
];

function isPreset(hex: string): boolean {
  const lower = hex.toLowerCase();
  return ACCENT_SWATCH_HEXES.some((h) => h.toLowerCase() === lower);
}

/**
 * `SwatchGrid`'s closed `SWATCH_CLASS` map (chunk A1) is kept hex-for-hex in
 * sync with `ACCENT_SWATCH_HEXES` (chunk A0, `palette.ts`) by hand, since
 * `SwatchGrid` deliberately doesn't import from this design model. If the two
 * ever drift again, an unmatched hex still degrades safely to `SwatchGrid`'s
 * neutral fallback chip rather than crashing — clicking it still commits the
 * real hex correctly — but it should read as a bug to fix, not an accepted
 * gap.
 */
const ColorsPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();
  const { colors } = design;

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Application Area"
        options={AREA_OPTIONS}
        value={colors.area}
        onChange={(area) => dispatch({ type: "colors/setArea", area })}
      />

      <SegmentedControl
        label="Mode"
        options={MODE_OPTIONS}
        value={colors.mode}
        onChange={(mode) => dispatch({ type: "colors/setMode", mode })}
      />

      {colors.mode === "single" ? (
        <SwatchGrid
          label="Accent Color"
          swatches={ACCENT_SWATCH_HEXES}
          value={colors.accent}
          onChange={(hex) => dispatch({ type: "colors/setAccent", hex })}
          customTrigger={
            <ColorWheelPopover
              value={colors.accent}
              selected={!isPreset(colors.accent)}
              onChange={(hex) => dispatch({ type: "colors/setAccent", hex })}
              onPreview={(hex) => dispatch({ type: "colors/setAccent", hex, transient: true })}
            />
          }
        />
      ) : (
        <>
          <SwatchGrid
            label="Primary Accent"
            swatches={ACCENT_SWATCH_HEXES}
            value={colors.accent}
            onChange={(hex) => dispatch({ type: "colors/setAccent", hex })}
            customTrigger={
              <ColorWheelPopover
                value={colors.accent}
                selected={!isPreset(colors.accent)}
                onChange={(hex) => dispatch({ type: "colors/setAccent", hex })}
                onPreview={(hex) => dispatch({ type: "colors/setAccent", hex, transient: true })}
              />
            }
          />
          <SwatchGrid
            label="Secondary Accent"
            swatches={ACCENT_SWATCH_HEXES}
            value={colors.accent2}
            onChange={(hex) => dispatch({ type: "colors/setAccentSlot", slot: 2, hex })}
            customTrigger={
              <ColorWheelPopover
                value={colors.accent2}
                selected={!isPreset(colors.accent2)}
                onChange={(hex) => dispatch({ type: "colors/setAccentSlot", slot: 2, hex })}
                onPreview={(hex) => dispatch({ type: "colors/setAccentSlot", slot: 2, hex, transient: true })}
              />
            }
          />
          <SwatchGrid
            label="Tertiary Accent"
            swatches={ACCENT_SWATCH_HEXES}
            value={colors.accent3}
            onChange={(hex) => dispatch({ type: "colors/setAccentSlot", slot: 3, hex })}
            customTrigger={
              <ColorWheelPopover
                value={colors.accent3}
                selected={!isPreset(colors.accent3)}
                onChange={(hex) => dispatch({ type: "colors/setAccentSlot", slot: 3, hex })}
                onPreview={(hex) => dispatch({ type: "colors/setAccentSlot", slot: 3, hex, transient: true })}
              />
            }
          />
        </>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-black/55">Apply Accent Color</span>
        {ACCENT_TARGETS.map((target) => (
          <ToggleRow
            key={target.id}
            label={target.label}
            size="sm"
            checked={colors.apply[target.id]}
            onCheckedChange={() => dispatch({ type: "colors/toggleTarget", target: target.id })}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorsPanel;
