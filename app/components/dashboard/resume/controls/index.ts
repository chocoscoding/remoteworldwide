/**
 * Resume customize-panel controls kit.
 *
 * Every control here is presentational and fully prop-driven — no design
 * types, no design context, nothing from `app/lib/dashboard/resume/**`. They
 * take generic props (`value`, `onChange`, `options`, `label`…) so the panels
 * that consume them own all the resume-specific typing.
 */

export { default as StepperSlider } from "./StepperSlider";
export type { StepperSliderProps, StepperSliderChangeOptions } from "./StepperSlider";

export { default as SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlProps, SegmentedControlOption } from "./SegmentedControl";

export { default as ThumbnailPicker } from "./ThumbnailPicker";
export type { ThumbnailPickerProps, ThumbnailOption } from "./ThumbnailPicker";

export { default as ToggleRow } from "./ToggleRow";
export type { ToggleRowProps } from "./ToggleRow";

export { default as SwatchGrid, SWATCH_CLASS, RESUME_SWATCH_HEXES } from "./SwatchGrid";
export type { SwatchGridProps } from "./SwatchGrid";

export { default as ColorWheelPopover, normalizeHex } from "./ColorWheelPopover";
export type { ColorWheelPopoverProps } from "./ColorWheelPopover";

export { default as LabeledSelect } from "./LabeledSelect";
export type { LabeledSelectProps, LabeledSelectOption } from "./LabeledSelect";

export { default as CollapsibleGroup } from "./CollapsibleGroup";
export type { CollapsibleGroupProps } from "./CollapsibleGroup";
