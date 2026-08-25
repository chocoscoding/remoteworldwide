/**
 * Public surface of the paper renderer (chunk A2). Chunk A3 should import
 * from here rather than reaching into individual files — `ResumePaper` is
 * the only component most callers need; the rest are exported for the parts
 * of A3 that compose alongside it (`PageGuides`) or need the chrome/section
 * types directly.
 */

export { default as ResumePaper } from "./ResumePaper";
export type { ResumePaperProps } from "./ResumePaper";

export { default as PageGuides } from "./PageGuides";
export type { PageGuidesProps } from "./PageGuides";

export { default as SectionRenderer } from "./SectionRenderer";
export type { SectionRendererProps } from "./SectionRenderer";

export { default as SectionHeading } from "./SectionHeading";
export type { SectionHeadingProps } from "./SectionHeading";

export { default as HeaderBlock } from "./HeaderBlock";
export type { HeaderBlockProps } from "./HeaderBlock";

export { default as EntryHeader, EntryBullets } from "./EntryHeader";
export type { EntryHeaderProps, EntryBulletsProps } from "./EntryHeader";

export type { ChromeId } from "@/app/lib/dashboard/resume/design-types";
export type { ChromeProps } from "./chrome/types";
export { CHROME_COMPONENTS } from "./chrome";
