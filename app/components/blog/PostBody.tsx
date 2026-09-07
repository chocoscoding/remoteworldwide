import type { FC } from "react";
import type { PostSegment } from "@/app/lib/blog/render";
import LeadMagnetCard, { type LeadMagnetSummary } from "./LeadMagnetCard";
import CtaCard, { type CtaSummary } from "./CtaCard";

export interface PostBodyProps {
  segments: PostSegment[];
  blogSlug: string;
  leadMagnet: LeadMagnetSummary | null;
  magnetsBySlug: Record<string, LeadMagnetSummary>;
  cta: CtaSummary | null;
  ctasByKey: Record<string, CtaSummary>;
  nextStep?: { label: string; href: string };
}

const PostBody: FC<PostBodyProps> = ({ segments, blogSlug, leadMagnet, magnetsBySlug, cta, ctasByKey, nextStep }) => (
  <div>
    {segments.map((seg, i) => {
      if (seg.type === "html") {
        return <div key={i} className="post-prose" dangerouslySetInnerHTML={{ __html: seg.html }} />;
      }
      if (seg.kind === "cta") {
        const chosen = seg.ref ? (ctasByKey[seg.ref] ?? null) : cta;
        return chosen ? <CtaCard key={i} cta={chosen} variant="inline" placement="inline" blogSlug={blogSlug} /> : null;
      }
      const magnet = seg.ref ? (magnetsBySlug[seg.ref] ?? null) : leadMagnet;
      return magnet ? <LeadMagnetCard key={i} magnet={magnet} variant="inline" placement="inline" blogSlug={blogSlug} nextStep={nextStep} /> : null;
    })}
  </div>
);

export default PostBody;
