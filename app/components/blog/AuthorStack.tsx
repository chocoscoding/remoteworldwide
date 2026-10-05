import type { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAuthorNames } from "@/app/lib/blog/authors";

export { formatAuthorNames };

export interface StackAuthor {
  name: string;
  slug: string;
  profileImage: string;
}

const SIZES = { sm: { avatar: "h-6 w-6", overlap: "-ml-2", px: "24px", text: "text-xs" }, md: { avatar: "h-10 w-10", overlap: "-ml-3", px: "40px", text: "text-sm" } } as const;

const AuthorStack: FC<{ authors: StackAuthor[]; size?: keyof typeof SIZES; meta?: string; link?: boolean; className?: string }> = ({ authors, size = "sm", meta, link = true, className }) => {
  const s = SIZES[size];
  const shown = authors.slice(0, 3);
  const names = formatAuthorNames(authors.map((a) => a.name));
  const Name = link ? Link : "span";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex flex-none items-center" aria-hidden>
        {shown.map((a, i) => (
          <span key={a.slug} className={cn("relative overflow-hidden rounded-full border-2 border-primary bg-white", s.avatar, i > 0 && s.overlap)} style={{ zIndex: shown.length - i }}>
            <Image src={a.profileImage} alt="" fill sizes={s.px} className="object-cover" />
          </span>
        ))}
        {authors.length > 3 && (
          <span className={cn("relative grid place-content-center rounded-full border-2 border-primary bg-secondary font-extrabold text-primary", s.avatar, s.overlap, size === "sm" ? "text-[9px]" : "text-[11px]")}>
            +{authors.length - 3}
          </span>
        )}
      </span>
      <span className={cn("min-w-0", s.text)}>
        <Name href={`/author/${authors[0]?.slug ?? ""}`} className={cn("block truncate font-bold text-primary", link && "hover:underline")}>
          {names}
        </Name>
        {meta && <span className="block text-primary/55">{meta}</span>}
      </span>
    </span>
  );
};

export default AuthorStack;
