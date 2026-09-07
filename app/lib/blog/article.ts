import { renderPost, type RenderedPost } from "./render";
import { effectiveInlineOffers, offerMarker } from "./offers";
import type { Cta, LeadMagnet } from "./types";

export interface ArticleOffers {
  leadMagnet: LeadMagnet | null;
  cta: Cta | null;
  magnets: LeadMagnet[];
  ctas: Cta[];
}

export function renderArticle(post: { content: string; inlineOffers: string[]; autoCtas: boolean }, offers: ArticleOffers): RenderedPost {
  const magnetSlugs = new Set(offers.magnets.map((m) => m.slug));
  const ctaKeys = new Set(offers.ctas.map((c) => c.key));
  const markers = effectiveInlineOffers(post)
    .filter((o) => (o.kind === "cta" ? (o.ref === "auto" ? Boolean(offers.cta) : ctaKeys.has(o.ref)) : o.ref === "auto" ? Boolean(offers.leadMagnet) : magnetSlugs.has(o.ref)))
    .map(offerMarker);
  return renderPost(post.content, { offers: markers });
}
