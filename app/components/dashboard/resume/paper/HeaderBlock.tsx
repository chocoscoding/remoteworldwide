import type { FC } from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type {
  HeaderArrange,
  PhotoPosition,
  PhotoShape,
  ResumeDesign,
  SeparatorMode,
} from "@/app/lib/dashboard/resume/design-types";
import { ICON_SETS, type IconSet } from "@/app/lib/dashboard/resume/icon-sets";

export interface HeaderBlockProps {
  content: ResumeContent;
  design: ResumeDesign;
}

const PHOTO_SHAPE_CLASS: Record<PhotoShape, string> = {
  circle: "rounded-full",
  square: "rounded-none",
  rounded: "rounded-xl",
};

const PHOTO_POSITION_WRAP_CLASS: Record<PhotoPosition, string> = {
  left: "flex-row",
  right: "flex-row-reverse",
  above: "flex-col",
};

const ARRANGE_CLASS: Record<HeaderArrange, string> = {
  stack: "flex flex-col items-start gap-[2pt]",
  inline: "flex flex-wrap items-center gap-x-[10pt] gap-y-[2pt]",
  split: "flex items-center justify-between gap-x-[10pt] gap-y-[2pt]",
};

// Text-separator glyphs for the "bullet"/"bar" SeparatorMode values, static
// lookup per the house pattern (glyph choice is data, not computed). "icon"
// has no entry — it renders a per-item icon instead of a joining glyph.
const SEPARATOR_TEXT: Record<Exclude<SeparatorMode, "icon">, string> = {
  bullet: "•",
  bar: "|",
};

interface ContactItem {
  key: string;
  Icon: IconSet["mail"];
  text: string;
}

/** Only the 3 fields with a natural icon in `IconSet`; `content.portfolio` and
 * `content.links` are intentionally not folded in here — links get their own
 * row below, gated by `design.links.*`, and `portfolio` isn't part of this
 * chunk's header contract (see the chunk report). */
function buildContactItems(content: ResumeContent, iconSet: IconSet): ContactItem[] {
  const items: ContactItem[] = [];
  if (content.email) items.push({ key: "email", Icon: iconSet.mail, text: content.email });
  if (content.phone) items.push({ key: "phone", Icon: iconSet.phone, text: content.phone });
  if (content.location) items.push({ key: "location", Icon: iconSet.pin, text: content.location });
  return items;
}

/**
 * Name, professional title, contact row(s) and an optional photo/links row —
 * everything above the section list. Rendered directly from `content` +
 * `design.header`/`design.photo`/`design.links`, independent of the sections
 * array (Personal Details is a locked, structurally-special entry that
 * ResumePaper splits off before touching `buildLayout`; see its own header
 * comment).
 */
const HeaderBlock: FC<HeaderBlockProps> = ({ content, design }) => {
  const alignCenter = design.header.align === "center";
  const iconSet = ICON_SETS[design.header.iconSet];
  const contactItems = buildContactItems(content, iconSet);
  const useIcons = design.header.separator === "icon";
  const glyph = design.header.separator === "icon" ? "" : SEPARATOR_TEXT[design.header.separator];

  const photoBlock = design.photo.show ? (
    <div
      aria-hidden
      className={cn(
        "flex h-[var(--r-photo-size)] w-[var(--r-photo-size)] flex-none items-center justify-center border border-black/10 bg-black/5 text-[color:var(--r-text-muted)]",
        PHOTO_SHAPE_CLASS[design.photo.shape]
      )}>
      <ImageIcon className="h-[40%] w-[40%]" />
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "flex gap-[var(--r-gap)]",
        PHOTO_POSITION_WRAP_CLASS[design.photo.position],
        alignCenter && "items-center text-center"
      )}>
      {photoBlock}
      <div className={cn("min-w-0 flex-1", alignCenter && "flex flex-col items-center")}>
        <p className="font-[family-name:var(--r-font-name)] text-[length:var(--r-fs-name)] font-bold leading-tight text-[color:var(--r-c-name)]">
          {content.name}
        </p>
        {content.title && (
          <p className="mt-[2pt] text-[length:var(--r-fs-title)] leading-tight text-[color:var(--r-c-title)]">{content.title}</p>
        )}

        {contactItems.length > 0 && (
          <div className={cn("mt-[6pt] text-[length:var(--r-fs-small)]", ARRANGE_CLASS[design.header.arrange])}>
            {contactItems.map((item, i) => (
              <span key={item.key} className="inline-flex items-center gap-[4pt] text-[color:var(--r-text-muted)]">
                {useIcons ? (
                  <item.Icon aria-hidden className="h-[1em] w-[1em] flex-none text-[color:var(--r-c-header-icon)]" />
                ) : (
                  i > 0 &&
                  design.header.arrange !== "stack" && (
                    <span aria-hidden className="text-[color:var(--r-text-muted)]">
                      {glyph}
                    </span>
                  )
                )}
                <span>{item.text}</span>
              </span>
            ))}
          </div>
        )}

        {design.links.show && content.links.length > 0 && (
          <div className={cn("mt-[4pt] flex flex-wrap gap-x-[10pt] gap-y-[2pt] text-[length:var(--r-fs-small)]", alignCenter && "justify-center")}>
            {content.links.map((link) => (
              <span key={link.url} className="inline-flex items-center gap-[4pt] text-[color:var(--r-text-muted)]">
                {(design.links.style === "icon" || design.links.style === "both") && (
                  <iconSet.link aria-hidden className="h-[1em] w-[1em] flex-none text-[color:var(--r-c-link-icon)]" />
                )}
                {(design.links.style === "text" || design.links.style === "both") && (
                  <span className={cn(design.links.underline && "underline")}>{link.label}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderBlock;
