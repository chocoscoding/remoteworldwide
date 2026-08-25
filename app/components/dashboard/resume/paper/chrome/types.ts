import type { ReactNode } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";

/**
 * Props every chrome component receives. `header`, `children` and `side` are
 * already-rendered ReactNode — a chrome component's only job is to arrange
 * these three slots into a page shell (bleeds, fills, frame rules); it never
 * reaches into `content`/`design` to render text itself. Those two are still
 * passed through because a couple of chromes need them for structural
 * decisions (e.g. whether to render the sidebar `<aside>` at all).
 *
 * `header` is a third slot beyond what spec §5 originally sketched
 * (`children`/`side` only) — that shape breaks down for `sidebar-fill`
 * (FlowCV puts name/photo/contact INSIDE the colored sidebar) and
 * `header-block` (a colored band CONTAINING the header). Giving chrome the
 * rendered header as its own slot lets each of the 5 chromes decide where it
 * sits instead of ResumePaper hard-coding one placement for all of them.
 */
export interface ChromeProps {
  design: ResumeDesign;
  content: ResumeContent;
  /** The rendered HeaderBlock — chrome decides WHERE it sits. */
  header: ReactNode;
  /** Main-column sections, already rendered by SectionRenderer. */
  children: ReactNode;
  /** Side-column sections, already rendered by SectionRenderer; null in one-column layouts. */
  side: ReactNode | null;
}
