export type OfferKind = "cta" | "magnet";

export interface OfferRef {
  kind: OfferKind;
  ref: string;
}

export const AUTO = "auto";

export function parseOfferToken(token: string): OfferRef | null {
  const m = /^(cta|magnet):([a-z0-9][a-z0-9-]*)$/i.exec(token.trim());
  if (!m) return null;
  return { kind: m[1].toLowerCase() as OfferKind, ref: m[2].toLowerCase() };
}

export function offerToken(offer: OfferRef): string {
  return `${offer.kind}:${offer.ref}`;
}

export function offerMarker(offer: OfferRef): string {
  const word = offer.kind === "cta" ? "cta" : "magnet";
  return offer.ref === AUTO ? `[[${word}]]` : `[[${word}:${offer.ref}]]`;
}

export const DEFAULT_INLINE_OFFERS: string[] = ["cta:auto"];

export function effectiveInlineOffers(post: { inlineOffers: string[]; autoCtas: boolean }): OfferRef[] {
  const parsed = post.inlineOffers.map(parseOfferToken).filter((o): o is OfferRef => o !== null);
  if (parsed.length > 0) return parsed;
  return post.autoCtas ? DEFAULT_INLINE_OFFERS.map((t) => parseOfferToken(t)!).filter(Boolean) : [];
}
