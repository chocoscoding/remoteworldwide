import type { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import { Globe, Instagram, Linkedin, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AuthorSummary {
  name: string;
  slug: string;
  profileImage: string;
  about?: string | null;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  instagram?: string | null;
}

const AuthorCard: FC<{ author: AuthorSummary; variant?: "full" | "mini"; label?: string; className?: string }> = ({ author, variant = "full", label = "Written by", className }) => {
  const socials = [
    { href: author.website, icon: Globe, label: "Website" },
    { href: author.linkedin, icon: Linkedin, label: "LinkedIn" },
    { href: author.twitter, icon: Twitter, label: "X" },
    { href: author.instagram, icon: Instagram, label: "Instagram" },
  ].filter((s) => s.href);

  if (variant === "mini") {
    return (
      <Link href={`/author/${author.slug}`} className={cn("group flex items-center gap-3", className)}>
        <span className="relative h-12 w-12 flex-none overflow-hidden rounded-full border-2 border-primary">
          <Image src={author.profileImage} alt="" fill sizes="48px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-primary/55">{label}</span>
          <span className="block text-sm font-bold text-primary group-hover:underline">{author.name}</span>
        </span>
      </Link>
    );
  }

  return (
    <section aria-label="About the author" className={cn("not-prose rounded-[20px] border-2 border-primary bg-white p-6 shadow-[4px_4px_0_0_#222325]", className)}>
      <div className="flex items-start gap-4">
        <span className="relative h-16 w-16 flex-none overflow-hidden rounded-full border-2 border-primary">
          <Image src={author.profileImage} alt="" fill sizes="64px" className="object-cover" />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-primary/55">{label}</p>
          <Link href={`/author/${author.slug}`} className="mt-0.5 block text-lg font-extrabold text-primary hover:underline">
            {author.name}
          </Link>
          {author.about && <p className="mt-1.5 text-sm leading-relaxed text-primary/70">{author.about}</p>}
          {socials.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href!} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="grid h-8 w-8 place-content-center rounded-full border border-primary/20 text-primary/70 transition-colors hover:border-primary hover:text-primary">
                  <s.icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AuthorCard;
