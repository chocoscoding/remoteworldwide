export type BlogStatus = "DRAFT" | "PUBLISHED";
export type CtaTone = "INK" | "LIME" | "PAPER";
export type CtaImageSide = "LEFT" | "RIGHT";
export type CategoryMap = Record<string, string>;

export interface AuthorSummary {
  name: string;
  profileImage: string;
  slug: string;
}

export interface AuthorProfile extends AuthorSummary {
  about: string;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  instagram: string | null;
}

export interface Author extends AuthorProfile {
  id: string;
  createdAt: Date;
}

export interface PostCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  tags: string[];
  category: string;
  featuredRank: number | null;
  createdAt: Date;
  publishedAt: Date | null;
  author: AuthorSummary;
}

export interface PostFull extends Omit<PostCard, "author"> {
  content: string;
  updatedAt: Date;
  status: BlogStatus;
  authorId: string;
  previousSlugs: string[];
  leadMagnetId: string | null;
  ctaKey: string | null;
  autoCtas: boolean;
  inlineOffers: string[];
  author: AuthorProfile;
}

export type Blog = PostFull;

export interface LeadMagnet {
  id: string;
  slug: string;
  title: string;
  hook: string;
  bullets: string[];
  buttonLabel: string;
  fileUrl: string;
  fileName: string;
  coverImage: string | null;
  targetCategories: string[];
  targetTags: string[];
  active: boolean;
  claims: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cta {
  id: string;
  key: string;
  name: string;
  eyebrow: string | null;
  headline: string;
  body: string;
  buttonLabel: string;
  href: string;
  tone: CtaTone;
  imageUrl: string | null;
  imageSide: CtaImageSide;
  targetCategories: string[];
  targetTags: string[];
  active: boolean;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogSettings {
  flagshipLeadMagnetSlug: string | null;
  defaultCtaKey: string | null;
  indexCtaKey: string | null;
  categoryLeadMagnets: CategoryMap;
  categoryCtas: CategoryMap;
  updatedAt: Date | null;
}

export interface SubscriberClaim {
  placement: string;
  blogSlug: string | null;
  createdAt: Date;
  leadMagnet: { title: string; slug: string };
}

export interface Subscriber {
  id: string;
  email: string;
  source: string;
  firstBlogSlug: string | null;
  tags: string[];
  consentAt: Date;
  unsubscribedAt: Date | null;
  createdAt: Date;
  claims: SubscriberClaim[];
}

export interface Offers {
  magnets: LeadMagnet[];
  ctas: Cta[];
  settings: BlogSettings;
  flagship: LeadMagnet | null;
  leadMagnet: LeadMagnet | null;
  cta: Cta | null;
}
